-- Легальний спосіб узяти частку наперед.
--
-- Навіщо. Наступною міграцією на `safes` вмикається CHECK на невід'ємні
-- половини балансу. Без цієї функції він означав би, що власник більше не може
-- взяти гроші, яких у сейфі ЧП ще немає, — а він їх однаково візьме, просто
-- повз систему, і сейфи знову почнуть брехати. Тобто вся робота з авансом була
-- б марною. Запобіжник має мати легальний обхід, інакше його обійдуть нелегально.
--
-- Що робить. Ділить вилучення на дві частини:
--   * скільки покриває сейф ЧП — це звичайна частка, вона зменшує сейф і
--     лишається в базі нарахування (`fromSafeTotal` у `buildLedger`);
--   * решта — аванс з іншого сейфа. Ці гроші сейфа ЧП не бачили, тож базу не
--     збільшують, але проти власника рахуються повністю: `isAdvance` у
--     `buildLedger` впізнає їх за тим, що джерело ≠ ЧП.
-- Обидві частини — окремі транзакції, бо саме за джерелом леджер їх і розрізняє.
--
-- Атомарно однією функцією, а не двома викликами з сервера: якщо друга частина
-- впаде, перша не має лишитись записаною. Половина вилучення — гірше, ніж
-- жодного.
--
-- Перевіряється ПОЛОВИНА балансу, а не `balance`. Стара `withdraw_owner_share`
-- дивиться на загальний `balance`, і сейф із 100 готівкою та 900 карткою
-- пропускав перевірку на 500 готівкою — далі його ловив `safe_apply`, але вже
-- повідомленням не про те.
--
-- Стару `withdraw_owner_share` НЕ чіпаємо: вона лишається робочою для чистого
-- випадку, і дропати її в той самий деплой означало б вікно, у якому вже
-- задеплоєна база не має функції, яку ще кличе не задеплоєний код.

create or replace function public.withdraw_owner_share_with_advance(
  p_np_safe_id      uuid,
  p_advance_safe_id uuid,
  p_amount          integer,
  p_desc_text       text,
  p_user_id         uuid,
  p_payment_method  text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_np        public.safes%rowtype;
  v_adv       public.safes%rowtype;
  v_available integer;
  v_from_np   integer;
  v_advance   integer;
  v_desc      text;
  v_method_uk text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Сума вилучення має бути більше 0';
  end if;

  if p_payment_method not in ('cash', 'cashless') then
    raise exception 'Невідомий спосіб оплати: %', p_payment_method;
  end if;

  v_method_uk := case when p_payment_method = 'cash' then 'готівкою' else 'безготівкою' end;
  v_desc := coalesce(nullif(p_desc_text, ''), 'Вилучення частки прибутку співвласника');

  select * into v_np from public.safes where id = p_np_safe_id for update;
  if not found then
    raise exception 'Сейф не знайдено';
  end if;
  if v_np.type <> 'net_profit' then
    raise exception 'Сейф "%" не є сейфом чистого прибутку — частку з нього знімати не можна', v_np.name;
  end if;

  v_available := greatest(
    case when p_payment_method = 'cash' then v_np.balance_cash else v_np.balance_cashless end,
    0
  );
  v_from_np := least(p_amount, v_available);
  v_advance := p_amount - v_from_np;

  if v_advance > 0 then
    if p_advance_safe_id is null then
      raise exception 'У сейфі "%" лише % грн %. Щоб узяти % грн наперед, оберіть сейф, з якого списати аванс',
        v_np.name, v_available, v_method_uk, v_advance;
    end if;

    select * into v_adv from public.safes where id = p_advance_safe_id for update;
    if not found then
      raise exception 'Сейф для авансу не знайдено';
    end if;

    -- Без цієї перевірки аванс «із сейфа ЧП» був би звичайним вилученням, яке
    -- обійшло перевірку балансу — рівно тим, що загнало сейф у мінус 01.08.
    if v_adv.id = v_np.id or v_adv.type = 'net_profit' then
      raise exception 'Аванс беруть з іншого сейфа, не з "%"', v_np.name;
    end if;
  end if;

  -- Частка з ЧП. Нуль можливий: у сейфі порожньо, усе йде авансом.
  if v_from_np > 0 then
    perform public.safe_apply(v_np.id, -v_from_np, p_payment_method);

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, description, created_by, payment_method
    ) values (
      v_from_np, 'safe', v_np.id, 'external', null,
      'distribution', v_desc, p_user_id, p_payment_method
    );
  end if;

  -- Аванс. Позначаємо в описі: за джерелом його впізнає код, а людині в списку
  -- операцій має бути видно, що це взято наперед, а не зароблене.
  if v_advance > 0 then
    perform public.safe_apply(v_adv.id, -v_advance, p_payment_method);

    insert into public.transactions (
      amount, from_type, from_id, to_type, to_id,
      reference_type, description, created_by, payment_method
    ) values (
      v_advance, 'safe', v_adv.id, 'external', null,
      'distribution',
      format('Аванс власника: %s (у сейфі «%s» бракувало %s грн)', v_desc, v_np.name, v_advance),
      p_user_id, p_payment_method
    );
  end if;
end;
$$;

-- Права. Postgres роздає EXECUTE ролі PUBLIC за замовчуванням, а `anon` у неї
-- входить — тобто SECURITY DEFINER-функція, яка рухає гроші, була б доступна
-- без входу. Відбираємо в PUBLIC і роздаємо поіменно.
revoke execute on function public.withdraw_owner_share_with_advance(uuid, uuid, integer, text, uuid, text) from public, anon;
grant  execute on function public.withdraw_owner_share_with_advance(uuid, uuid, integer, text, uuid, text) to authenticated, service_role;

-- Те саме для старої функції. Міграція 20260721135206 уже відбирала в `anon`
-- права на SECURITY DEFINER-функції, але 20260729120600 перестворила
-- `withdraw_owner_share` через CREATE OR REPLACE зі згенерованого визначення —
-- і дозвіл мовчки повернувся за замовчуванням. Це відновлення наміру тієї
-- міграції, а не нове рішення.
revoke execute on function public.withdraw_owner_share(text, uuid, numeric, text, uuid, text) from public, anon;
grant  execute on function public.withdraw_owner_share(text, uuid, numeric, text, uuid, text) to authenticated, service_role;
