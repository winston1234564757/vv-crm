-- Три витрати «Інше», оплачені безготівкою з каси «Безготівка» 07-08.08 —
-- не операційна витрата магазину, а особисті гроші власників (Денісу за
-- роботу з дисплеєм і плату, Вітосу на карту). Досі різали операційний
-- прибуток; мають різати частку власників у чистому прибутку.
--
-- Сейф ЧП тут ні до чого джерелом: у нього 0 безготівки, а гроші пішли з каси
-- «Безготівка» карткою — так само, як у 20260804130000. Тому це аванс: базу
-- нарахування не збільшує, але проти власника рахується повністю
-- (buildLedger, data-dashboard.ts, isAdvance).
--
-- Балансів це не чіпає: гроші вже пішли з каси 07-08.08, сьогодні лише
-- перейменовується подія (витрата → вилучення частки). Тому старі рядки
-- видаляються НАПРЯМУ, а не через delete_transaction — та повернула б касі
-- безготівку, якої на картці нема.
--
-- Прив'язка за description+amount, а не за id: описи унікальні в базі,
-- повторний запуск нічого не зробить (NOT FOUND → notice і return).

do $$
declare
  v_viktor uuid;
  v_ivan   uuid;
  v_exp    public.expenses%rowtype;
  v_tx     public.transactions%rowtype;
  v_half   integer;
begin
  select id into v_viktor from public.profiles where full_name = 'viktor.koshel24@gmail.com' and role = 'owner';
  select id into v_ivan   from public.profiles where full_name = 'vanekbutenko7@gmail.com' and role = 'owner';

  if v_viktor is null or v_ivan is null then
    raise exception 'Не знайшли обох власників за email — перевір profiles.full_name';
  end if;

  -- 1) «Денісу Плата» 2000 — порівну.
  select * into v_exp from public.expenses
   where amount = 2000 and description = 'Денісу Плата';
  if found then
    select * into v_tx from public.transactions
     where reference_type = 'expense' and amount = v_exp.amount and description = v_exp.description
       and from_type = 'cash_register' and from_id = v_exp.paid_from_register_id
     order by created_at limit 1;
    if not found then
      raise exception 'Транзакцію «Денісу Плата» не знайдено — зупиняємось';
    end if;

    delete from public.transactions where id = v_tx.id;
    delete from public.expenses where id = v_exp.id;

    v_half := v_exp.amount / 2;
    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, description, created_by, payment_method, created_at
    ) values
      (v_half, 'cash_register', v_tx.from_id, 'external', null, 'distribution',
       'Вилучення частки, ½ від 2000: «Денісу Плата». Перекваліфіковано з витрати «Інше»; узято наперед, безготівки в сейфі ЧП нема',
       v_viktor, 'cashless', v_tx.created_at + interval '1 second'),
      (v_half, 'cash_register', v_tx.from_id, 'external', null, 'distribution',
       'Вилучення частки, ½ від 2000: «Денісу Плата». Перекваліфіковано з витрати «Інше»; узято наперед, безготівки в сейфі ЧП нема',
       v_ivan, 'cashless', v_tx.created_at + interval '2 seconds');

    raise notice 'Денісу Плата 2000: перекваліфіковано, по % кожному', v_half;
  else
    raise notice 'Витрати «Денісу Плата» 2000 немає — уже перекваліфіковано або не було';
  end if;

  -- 2) «Денісу дисплей» 1000 — порівну.
  select * into v_exp from public.expenses
   where amount = 1000 and description = 'Денісу дисплей';
  if found then
    select * into v_tx from public.transactions
     where reference_type = 'expense' and amount = v_exp.amount and description = v_exp.description
       and from_type = 'cash_register' and from_id = v_exp.paid_from_register_id
     order by created_at limit 1;
    if not found then
      raise exception 'Транзакцію «Денісу дисплей» не знайдено — зупиняємось';
    end if;

    delete from public.transactions where id = v_tx.id;
    delete from public.expenses where id = v_exp.id;

    v_half := v_exp.amount / 2;
    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, description, created_by, payment_method, created_at
    ) values
      (v_half, 'cash_register', v_tx.from_id, 'external', null, 'distribution',
       'Вилучення частки, ½ від 1000: «Денісу дисплей». Перекваліфіковано з витрати «Інше»; узято наперед, безготівки в сейфі ЧП нема',
       v_viktor, 'cashless', v_tx.created_at + interval '1 second'),
      (v_half, 'cash_register', v_tx.from_id, 'external', null, 'distribution',
       'Вилучення частки, ½ від 1000: «Денісу дисплей». Перекваліфіковано з витрати «Інше»; узято наперед, безготівки в сейфі ЧП нема',
       v_ivan, 'cashless', v_tx.created_at + interval '2 seconds');

    raise notice 'Денісу дисплей 1000: перекваліфіковано, по % кожному', v_half;
  else
    raise notice 'Витрати «Денісу дисплей» 1000 немає — уже перекваліфіковано або не було';
  end if;

  -- 3) «Вітос на карту, моно» 600 — повністю Віктору.
  select * into v_exp from public.expenses
   where amount = 600 and description = 'Вітос на карту, моно';
  if found then
    select * into v_tx from public.transactions
     where reference_type = 'expense' and amount = v_exp.amount and description = v_exp.description
       and from_type = 'cash_register' and from_id = v_exp.paid_from_register_id
     order by created_at limit 1;
    if not found then
      raise exception 'Транзакцію «Вітос на карту, моно» не знайдено — зупиняємось';
    end if;

    delete from public.transactions where id = v_tx.id;
    delete from public.expenses where id = v_exp.id;

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, description, created_by, payment_method, created_at
    ) values
      (v_exp.amount, 'cash_register', v_tx.from_id, 'external', null, 'distribution',
       'Вилучення частки, 600: «Вітос на карту, моно», одноосібно. Перекваліфіковано з витрати «Інше»; узято наперед, безготівки в сейфі ЧП нема',
       v_viktor, 'cashless', v_tx.created_at + interval '1 second');

    raise notice 'Вітос на карту 600: перекваліфіковано, повністю Віктору';
  else
    raise notice 'Витрати «Вітос на карту, моно» 600 немає — уже перекваліфіковано або не було';
  end if;
end $$;
