-- `refund_sale` була зламана повністю, а не просто небезпечна.
--
-- ГОЛОВНЕ: вона вставляє транзакцію з `reference_type = 'refund'`, а
-- `transactions_reference_type_check` такого значення не дозволяє (список із
-- `20260724120000`: sale, repair_payment, purchase, expense, distribution,
-- top_up, adjustment, device, accessory, part, inventory, client_order).
-- Тобто КОЖНЕ повернення падало на constraint violation, відкочуючи всю
-- транзакцію: залишки не відновлювались, статус не мінявся, гроші не рухались.
-- Нуль повернень у базі — це, найімовірніше, не «не було потреби», а
-- «не працювало».
--
-- Ще три дефекти, які проявились би одразу після першого:
--
-- 1. `UPDATE cash_registers SET balance = balance - amount` без підлоги.
--    У сейфів є `safes_halves_non_negative`, у кас — нічого. Каса після
--    інкасації порожня (три з чотирьох зараз мають 0), тож повернення
--    загнало б її в мінус і зламало звірку.
-- 2. Транзакція не отримувала `payment_method`. Усі читачі коалесять NULL у
--    «готівку», тож повернення на картку одразу створило б дрейф половин —
--    той самий, який щойно звели в нуль (`20260804164233`).
-- 3. Цикл по `sale_items` мовчки нічого не робив для позицій, чий `item_id`
--    указує на видалений товар (зараз таких 5). Гроші повертались би, залишок
--    не відновлювався, і ніхто б не дізнався.
--
-- Метод береться з `payment_splits.method` за тим самим правилом, що вже живе
-- в `src/lib/utils/finance.ts:targetRegisterType`: cash → cash, все інше
-- (card, transfer) → cashless. Правило одне на систему, SQL його повторює,
-- а не вигадує своє.

-- Дозволити 'refund' у реєстрі. Це окремий вид руху, а не різновид продажу:
-- `cashflow.ts` класифікує рух за типами сторін, тож касу→external він і так
-- порахує відпливом, але в розшифровці має бути видно, що це саме повернення.
alter table public.transactions drop constraint transactions_reference_type_check;
alter table public.transactions add constraint transactions_reference_type_check
  check (reference_type = any (array[
    'sale'::text, 'repair_payment'::text, 'purchase'::text, 'expense'::text,
    'distribution'::text, 'top_up'::text, 'adjustment'::text, 'device'::text,
    'accessory'::text, 'part'::text, 'inventory'::text, 'client_order'::text,
    'refund'::text
  ]));

create or replace function public.refund_sale(sale_id_to_refund uuid)
 returns void
 language plpgsql
 security definer
as $function$
declare
    item_record    record;
    payment_record record;
    v_balance      integer;
    v_method       text;
    v_touched      integer;
begin
    if not exists (select 1 from public.sales where id = sale_id_to_refund and status = 'completed') then
        raise exception 'Продаж не знайдено або він вже повернутий';
    end if;

    -- 1. Спершу перевірити, що грошей вистачить у КОЖНІЙ задіяній касі.
    --    Робимо це до будь-яких змін: часткове повернення гірше за жодне.
    for payment_record in
        select cash_register_id, amount, method
        from public.payment_splits
        where sale_id = sale_id_to_refund
    loop
        select balance into v_balance
        from public.cash_registers
        where id = payment_record.cash_register_id
        for update;

        if v_balance is null then
            raise exception 'Касу % не знайдено', payment_record.cash_register_id;
        end if;

        if v_balance < payment_record.amount then
            raise exception
              'У касі недостатньо коштів для повернення: потрібно % грн, є % грн. Спершу поверніть гроші із сейфа в касу.',
              payment_record.amount, v_balance;
        end if;
    end loop;

    -- 2. Відновити залишки. Позиція, чий товар видалено з каталогу, має
    --    сказати про себе вголос, а не зникнути.
    for item_record in
        select item_type, item_id, quantity
        from public.sale_items
        where sale_id = sale_id_to_refund
    loop
        if item_record.item_type = 'device' then
            update public.devices set status = 'in_stock', updated_at = now() where id = item_record.item_id;
        elsif item_record.item_type = 'accessory' then
            update public.accessories set stock = stock + item_record.quantity, updated_at = now() where id = item_record.item_id;
        elsif item_record.item_type = 'part' then
            update public.parts set stock = stock + item_record.quantity, updated_at = now() where id = item_record.item_id;
        elsif item_record.item_type = 'service' then
            -- Послуга не має залишку: повертати нічого.
            continue;
        end if;

        get diagnostics v_touched = row_count;
        if v_touched = 0 and item_record.item_type <> 'service' then
            raise warning
              'Повернення %: позиція % (%) не знайдена в каталозі, залишок не відновлено',
              sale_id_to_refund, item_record.item_id, item_record.item_type;
        end if;
    end loop;

    -- 3. Списати гроші з кас і записати рух у реєстр.
    for payment_record in
        select cash_register_id, amount, method
        from public.payment_splits
        where sale_id = sale_id_to_refund
    loop
        v_method := case when payment_record.method = 'cash' then 'cash' else 'cashless' end;

        update public.cash_registers
           set balance = balance - payment_record.amount, updated_at = now()
         where id = payment_record.cash_register_id;

        insert into public.transactions (
            amount, from_type, from_id, to_type, to_id,
            reference_type, reference_id, description, payment_method
        ) values (
            payment_record.amount,
            'cash_register',
            payment_record.cash_register_id,
            'external',
            null,
            'refund',
            sale_id_to_refund,
            'Повернення продажу #' || substring(sale_id_to_refund::text, 1, 8),
            v_method
        );
    end loop;

    update public.sales set status = 'refunded' where id = sale_id_to_refund;
end;
$function$;

-- Перевірка: значення тепер дозволене, а функція його справді пише.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'transactions_reference_type_check'
                   and pg_get_constraintdef(oid) like '%refund%') then
    raise exception 'reference_type досі не дозволяє refund';
  end if;
  if not exists (select 1 from pg_proc
                 where proname = 'refund_sale'
                   and pg_get_functiondef(oid) ilike '%payment_method%') then
    raise exception 'refund_sale не проставляє payment_method';
  end if;
end $$;
