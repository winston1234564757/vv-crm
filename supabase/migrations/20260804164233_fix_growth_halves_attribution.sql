-- Половинки сейфа Growth розходились із реєстром на 550 ₴.
--
-- Стан до: Growth `balance` = 4500 і сходиться з реєстром точно (drift 0), але
--   balance_cash     = 4500   проти реєстрових  5050
--   balance_cashless = 0      проти реєстрових  -550
-- Реєстрова безготівкова половина виходила відʼємною, що фізично неможливо і
-- заборонено CHECK `safes_halves_non_negative` (`20260803140000`). Тобто
-- помилялись не колонки, а реєстр.
--
-- Причина — рівно один рядок:
--   69ab955b-f892-4e78-959a-8b7e56e1e0bd, 29.07 09:32:44, 550 ₴,
--   каса «Безготівка» (type='cashless') → сейф Growth, reference_type='distribution',
--   payment_method = NULL
-- Гроші прийшли з БЕЗГОТІВКОВОЇ каси, отже це безготівка. Але `payment_method`
-- лишився NULL, а всі читачі роблять `COALESCE(payment_method,'cash')` — тож
-- реєстр порахував цей прихід готівкою. Через 71 секунду ті самі 550 ₴ пішли
-- на закупівлю деталей рядком 3f2245a0-70e1-44cf-acbc-258d6cd11d4c, і той уже
-- має `payment_method='cashless'`. Звідси й перекіс: витрата безготівкова,
-- прихід порахований готівковим.
--
-- Дата не випадкова: `20260729120000` (колонки-половинки) і `20260729120100`
-- (`safe_apply`) застосовані того ж дня. Рядок 09:32:44 старший за них на
-- кілька годин — він писався ще старим кодом, який `payment_method` не ставив.
--
-- Виправляємо реєстр, а не колонки. Колонки — джерело правди (`safe_apply`
-- тримає їх під CHECK'ом), реєстр — слід операцій. Коли вони розходяться,
-- правити слід і лишати правду недоторканою; правити правду під слід означало б
-- зробити другу помилку поверх першої. Жоден баланс тут не змінюється.

do $$
declare
  v_updated integer;
  v_cash    integer;
  v_cashless integer;
  v_bal_cash integer;
  v_bal_cashless integer;
begin
  update public.transactions
     set payment_method = 'cashless'
   where id = '69ab955b-f892-4e78-959a-8b7e56e1e0bd'
     and payment_method is null
     and amount = 550
     and from_type = 'cash_register'
     and to_type = 'safe';

  get diagnostics v_updated = row_count;

  -- Ідемпотентність: повторний запуск оновить 0 рядків, і це нормально.
  -- Але звірка нижче має зійтись у будь-якому разі.
  raise notice 'Оновлено рядків: %', v_updated;

  select
    coalesce(sum(case when t.to_id = s.id   and t.to_type='safe'
                       and coalesce(t.payment_method,'cash')='cash' then t.amount else 0 end),0)
  - coalesce(sum(case when t.from_id = s.id and t.from_type='safe'
                       and coalesce(t.payment_method,'cash')='cash' then t.amount else 0 end),0),
    coalesce(sum(case when t.to_id = s.id   and t.to_type='safe'
                       and coalesce(t.payment_method,'cash')='cashless' then t.amount else 0 end),0)
  - coalesce(sum(case when t.from_id = s.id and t.from_type='safe'
                       and coalesce(t.payment_method,'cash')='cashless' then t.amount else 0 end),0),
    max(s.balance_cash), max(s.balance_cashless)
    into v_cash, v_cashless, v_bal_cash, v_bal_cashless
  from public.safes s
  left join public.transactions t on (t.to_id = s.id or t.from_id = s.id)
  where s.name = 'Growth';

  if v_cash <> v_bal_cash or v_cashless <> v_bal_cashless then
    raise exception
      'Half-drift не закрився: реєстр cash=% cashless=%, колонки cash=% cashless=%',
      v_cash, v_cashless, v_bal_cash, v_bal_cashless;
  end if;
end $$;
