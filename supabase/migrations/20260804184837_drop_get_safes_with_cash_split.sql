-- Мертвий RPC із 29.07.
--
-- `get_safes_with_cash_split()` відновлював поділ сейфа на готівку/безготівку
-- з історії транзакцій, розносячи витрачене ПРОПОРЦІЙНО по обох кошиках.
-- Того ж дня `20260729120000` додала колонки `balance_cash`/`balance_cashless`,
-- які веде `safe_apply` на кожному записі під CHECK-обмеженням. Тобто оцінку
-- замінив факт, і вони не збігались: на 31.07 Growth за RPC мав 3 873 готівки
-- й 3 327 картки, за колонками — 5 151 і 2 049.
--
-- Функція ще й могла повернути відʼємну готівку (її власний коментар це
-- визнавав), що `safes_halves_non_negative` (`20260803140000`) на справжніх
-- колонках прямо забороняє.
--
-- Жодного виклику в `src/` немає — тільки згадка в докстрінгу
-- `data-finance.ts`, оновлена цим же комітом. `20260804162948` показала ще й
-- те, що функція була доступна `anon`.

drop function if exists public.get_safes_with_cash_split();

do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_safes_with_cash_split'
  ) then
    raise exception 'get_safes_with_cash_split досі існує';
  end if;
end $$;
