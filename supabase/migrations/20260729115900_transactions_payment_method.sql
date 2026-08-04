-- Відновлення наміру заднім числом: колонки `transactions.payment_method`
-- немає в жодній міграції, але вона є в проді.
--
-- Її додали поза ланцюгом міграцій десь до 29.07, і вже наступного дня на неї
-- сперлась ціла серія: `20260729120200`…`20260729120900` читають і пишуть
-- `payment_method` у кожній грошовій функції, а `20260729120900`
-- (`delete_transaction`) робить `COALESCE(payment_method,'cash')`. Тобто чистий
-- деплой із репо падав би на першій же з них.
--
-- Штамп `115900` — за хвилину до `20260729120000_safe_halves_columns.sql`,
-- першої міграції, якій ця колонка потрібна.
--
-- Точний вигляд знято з прода (`information_schema` + `pg_constraint`), не
-- вгаданий: text, nullable, без дефолту, з CHECK на два значення або NULL.
-- NULL дозволений навмисно — на момент написання таких рядків 131, усі
-- створені до 29.07 старим кодом, який методу не проставляв. Читачі трактують
-- їх як готівку через явний COALESCE. Бекфілити їх у 'cash' не можна: це
-- означало б вигадати дані там, де насправді невідомо.
--
-- Ідемпотентна: на проді це no-op, сенс має лише для чистого розгортання.

alter table public.transactions
  add column if not exists payment_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_payment_method_check'
  ) then
    alter table public.transactions
      add constraint transactions_payment_method_check
      check (payment_method is null or payment_method = any (array['cash'::text, 'cashless'::text]));
  end if;
end $$;

comment on column public.transactions.payment_method is
  'cash | cashless | NULL. NULL — рядки до 29.07.2026, читачі коалесять у cash.';
