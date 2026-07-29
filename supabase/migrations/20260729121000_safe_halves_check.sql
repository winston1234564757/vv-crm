-- Інваріант під захистом. Вмикається ОСТАННІМ і лише після двох застав:
--   1) жодна функція не пише в safes.balance повз safe_apply;
--   2) diff = 0 у всіх сейфах.
-- Раніше цей CHECK убив би кожну ще не переведену функцію й зупинив прийом
-- грошей посеред робочого дня — тихо, без попередження.
alter table public.safes drop constraint if exists safes_balance_halves_check;
alter table public.safes add constraint safes_balance_halves_check
  check (balance = balance_cash + balance_cashless);
