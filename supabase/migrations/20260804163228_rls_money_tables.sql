-- SECURITY: `expenses` і `expense_categories` захищені слабше, ніж `safes` і
-- `transactions`, хоча показують ті самі гроші.
--
-- `20260610120000` звузила `safes` і `transactions` до owner+manager, але
-- витрати лишились на бланкетній політиці `Enable ALL for authenticated` ще з
-- `20260608150000`. Тобто продавець або технік не бачить залишок сейфа, зате
-- може прочитати — і переписати — весь список витрат, з якого той залишок
-- складається. Плюс `expenses.paid_from_safe_id` показує, з якого саме сейфа
-- платили, тобто структуру сейфів теж видно.
--
-- Читачі цих таблиць — тільки грошові модулі:
--   src/lib/data-finance.ts, src/lib/data-day.ts, src/lib/profit-dataset.ts
-- і всі вони під `MONEY_ROLES` (сторінки `/admin/finance`, `/admin/days`,
-- грошова половина дашборду, роут `/api/ai-chat` з entityType='finance').
-- Тож звуження нікому нічого не ламає.
--
-- Окремо: `transactions` мала політику «Enable INSERT for all authenticated» —
-- будь-який автентифікований міг вписати довільний рядок у реєстр. Реєстр —
-- це джерело правди для звірки залишків, тож дописування в нього руками ламає
-- саме те, заради чого він існує. Жоден шлях у коді не вставляє в
-- `transactions` напряму (усі записи йдуть через SECURITY DEFINER RPC, а вони
-- RLS обходять), тож політика прибирається без заміни.

-- expenses
drop policy if exists "Enable ALL for authenticated users" on public.expenses;

create policy "Enable ALL for owners and managers on expenses"
  on public.expenses for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['owner'::text, 'manager'::text])
    )
  );

-- expense_categories
drop policy if exists "Enable ALL for authenticated users" on public.expense_categories;

create policy "Enable ALL for owners and managers on expense_categories"
  on public.expense_categories for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['owner'::text, 'manager'::text])
    )
  );

-- transactions: прибрати можливість дописувати в реєстр напряму
drop policy if exists "Enable INSERT for all authenticated users" on public.transactions;

-- Перевірка: жодна з трьох таблиць не повинна лишитись із бланкетною
-- політикою на `authenticated`.
do $$
declare
  loose text;
begin
  select string_agg(tablename || '.' || policyname, ', ')
    into loose
  from pg_policies
  where schemaname = 'public'
    and tablename in ('expenses', 'expense_categories', 'transactions')
    and qual is not null
    and qual not like '%profiles%';

  if loose is not null then
    raise exception 'Грошові таблиці досі мають незвужені політики: %', loose;
  end if;
end $$;
