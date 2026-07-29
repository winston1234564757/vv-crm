-- Єдине місце, де живе правило половин. Одинадцять грошових функцій інакше
-- мали б одинадцять копій «яка половина і коли відмовити».
create or replace function public.safe_apply(
  p_safe_id uuid,
  p_amount integer,
  p_method text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_half integer;
  v_name text;
begin
  if p_method not in ('cash', 'cashless') then
    raise exception 'Невідомий спосіб оплати: %', p_method;
  end if;

  if p_amount = 0 then
    return;
  end if;

  select name, case when p_method = 'cash' then balance_cash else balance_cashless end
    into v_name, v_half
  from public.safes where id = p_safe_id for update;

  if not found then
    raise exception 'Сейф не знайдено';
  end if;

  if p_amount < 0 and v_half < abs(p_amount) then
    raise exception 'У сейфі «%» лише % грн %, а списати треба % грн',
      v_name, v_half,
      case when p_method = 'cash' then 'готівкою' else 'безготівкою' end,
      abs(p_amount);
  end if;

  update public.safes
  set balance = balance + p_amount,
      balance_cash = balance_cash + case when p_method = 'cash' then p_amount else 0 end,
      balance_cashless = balance_cashless + case when p_method = 'cashless' then p_amount else 0 end,
      updated_at = now()
  where id = p_safe_id;
end;
$function$;

revoke execute on function public.safe_apply(uuid, integer, text) from anon;
