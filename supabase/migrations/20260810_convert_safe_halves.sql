-- Конвертація між готівковою і безготівковою половинами одного сейфу.
--
-- Навіщо.
-- «Обналічити» — це коли власник отримав кошти безготівкою (на карту) і видає
-- їх клієнту або постачальнику фізично. Гроші нікуди не зникають: загальний
-- баланс сейфу залишається тим самим. Змінюється лише поділ:
--   balance_cashless -= amount,  balance_cash += amount.
-- Зворотна операція — «закинути на карту»: взяв готівку, переклав на рахунок.
--
-- Чому не transfer_funds.
-- transfer_funds переміщує гроші між різними касами/сейфами. Тут джерело і
-- одержувач — один і той самий сейф; сума гарантовано не зникає і не двоїться.
--
-- Транзакція з from_id = to_id.
-- Поле reference_type = 'convert' — нове значення; міграція розширює CHECK.

-- 1. Додати 'convert' до дозволених reference_type
alter table public.transactions drop constraint transactions_reference_type_check;
alter table public.transactions add constraint transactions_reference_type_check
  check (reference_type = any (array[
    'sale'::text, 'repair_payment'::text, 'purchase'::text, 'expense'::text,
    'distribution'::text, 'top_up'::text, 'adjustment'::text, 'device'::text,
    'accessory'::text, 'part'::text, 'inventory'::text, 'client_order'::text,
    'refund'::text, 'convert'::text
  ]));

-- 2. Сама функція
create or replace function public.convert_safe_halves(
  p_safe_id   uuid,
  p_amount    integer,
  p_direction text,   -- 'cash_to_card' | 'card_to_cash'
  p_desc_text text,
  p_user_id   uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_safe       public.safes%rowtype;
  v_from_half  integer;
  v_desc       text;
  v_dir_uk     text;
begin
  -- Валідація напрямку
  if p_direction not in ('cash_to_card', 'card_to_cash') then
    raise exception 'Невідомий напрямок конвертації: %. Очікується cash_to_card або card_to_cash', p_direction;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Сума конвертації має бути більше 0';
  end if;

  -- Блокуємо рядок сейфа для атомарного оновлення
  select * into v_safe from public.safes where id = p_safe_id for update;
  if not found then
    raise exception 'Сейф не знайдено';
  end if;

  -- Перевіряємо, чи вистачає в потрібній половині
  if p_direction = 'cash_to_card' then
    v_from_half := v_safe.balance_cash;
    v_dir_uk    := 'готівки';
  else
    v_from_half := v_safe.balance_cashless;
    v_dir_uk    := 'безготівки';
  end if;

  if v_from_half < p_amount then
    raise exception 'У сейфі «%» лише % грн %. Конвертувати % грн неможливо',
      v_safe.name, v_from_half, v_dir_uk, p_amount;
  end if;

  v_desc := coalesce(nullif(p_desc_text, ''),
    case when p_direction = 'cash_to_card'
      then 'Конвертація: готівка → безготівка'
      else 'Конвертація: безготівка → готівка'
    end
  );

  -- Атомарне оновлення половин (balance залишається без змін!)
  update public.safes
  set
    balance_cash     = balance_cash     + case when p_direction = 'card_to_cash' then p_amount else -p_amount end,
    balance_cashless = balance_cashless + case when p_direction = 'cash_to_card' then p_amount else -p_amount end,
    updated_at       = now()
  where id = p_safe_id;

  -- Запис у журнал (from = to = той самий сейф; за цим маркером FinanceTransactionsTable
  -- зможе показати операцію як «внутрішня конвертація»)
  insert into public.transactions (
    from_type, from_id,
    to_type,   to_id,
    amount,
    reference_type,
    description,
    payment_method,
    user_id,
    date
  ) values (
    'safe', p_safe_id,
    'safe', p_safe_id,
    p_amount,
    'convert',
    v_desc,
    case when p_direction = 'cash_to_card' then 'cashless' else 'cash' end,
    p_user_id,
    (now() at time zone 'Europe/Kiev')::date
  );
end;
$$;

-- Закрити анонімний доступ — функція SECURITY DEFINER, тож без явного REVOKE
-- її може викликати будь-хто, у кого є HTTP-доступ до /rpc.
revoke execute on function public.convert_safe_halves(uuid, integer, text, text, uuid) from anon;
revoke execute on function public.convert_safe_halves(uuid, integer, text, text, uuid) from authenticated;

-- Дозволяємо тільки через service_role (Server Actions звертаються через нього)
grant execute on function public.convert_safe_halves(uuid, integer, text, text, uuid) to service_role;
