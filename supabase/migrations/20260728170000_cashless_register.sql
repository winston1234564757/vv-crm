-- Безготівковий рахунок живе поруч із касами, бо `transactions` уже вміє
-- `to_type = 'cash_register'`. Окрема таблиця вимагала б третього виду
-- сховища в кожному шляху читання, RPC і RLS.
--
-- CHECK на типі перелічує дозволені каси поіменно, тож новий вид сховища
-- треба спершу дозволити. Обмеження лишається переліком, а не знімається:
-- саме воно ловить одруківку в типі до того, як вона стане тихим рядком,
-- який ніде не показується.
alter table public.cash_registers drop constraint if exists cash_registers_type_check;

alter table public.cash_registers add constraint cash_registers_type_check
  check (type = any (array['repairs'::text, 'accessories'::text, 'tech'::text, 'cashless'::text]));

insert into public.cash_registers (name, type, balance)
select 'Безготівка', 'cashless', 0
where not exists (select 1 from public.cash_registers where type = 'cashless');
