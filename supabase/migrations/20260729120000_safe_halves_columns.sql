-- Дві половини балансу сейфа. `balance` лишається сумою і НЕ стає обчислюваною
-- колонкою: усі одинадцять грошових функцій пишуть у нього напряму, і
-- генерована колонка зламала б їх усі одночасно.
alter table public.safes
  add column if not exists balance_cash integer not null default 0,
  add column if not exists balance_cashless integer not null default 0;

comment on column public.safes.balance_cash is 'Готівкова частина балансу.';
comment on column public.safes.balance_cashless is 'Безготівкова частина балансу (картка, переказ).';

-- Засипка перевірена по реєстру: єдине безготівкове надходження в сейфи за весь
-- час — 550 грн у Growth, і рівно вони пішли карткою на акумулятор Samsung S22.
update public.safes set balance_cash = balance, balance_cashless = 0;

-- CHECK тут НЕ додається навмисно — він вб'є кожну ще не оновлену функцію.
