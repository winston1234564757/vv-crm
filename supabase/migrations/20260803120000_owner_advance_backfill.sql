-- Аванс власника замість від'ємного сейфа ЧП.
--
-- 01.08 з сейфа «Чистий прибуток» зняли 12 000, коли там лежало 4 268. Гроші
-- реальні — власник підтвердив, що це його частка, взята наперед. Але сейф
-- лишився з balance_cash = −3 498, а такого не буває: купюр у мінусі не існує.
-- Загальна сума купюр при цьому правильна, отже інший сейф числить на 3 498
-- більше готівки, ніж там фізично лежить. Разом вірно, в розрізі по сейфах —
-- брехня.
--
-- Модель уже вміє те, що тут потрібно. `buildLedger` (src/lib/data-dashboard.ts)
-- називає авансом будь-яке вилучення частки НЕ з сейфа ЧП: такі гроші сейфа не
-- бачили, тож базу нарахування не збільшують, але проти власника рахуються
-- повністю. Треба лише перекласти наявний борг у цю форму — переписувати
-- леджер не треба.
--
-- Два записи:
--   1) сторно частини вилучення: ЧП → external, від'ємна сума. Піднімає баланс
--      ЧП у нуль І зменшує `fromSafeTotal` у леджері на ту саму суму;
--   2) сам аванс: Growth → external, та сама сума додатна. `isAdvance` бачить
--      джерело ≠ ЧП і рахує це авансом.
--
-- Разом вони гасяться, тому:
--   accrualBase = safeBalance + fromSafeTotal  лишається 10 481 (−3 498 + 13 979
--                                              стає 0 + 10 481);
--   «знято власником»                          лишається 12 000;
--   сума купюр                                 лишається 16 000.
-- Бекфіл не створює і не нищить грошей — він лише перекладає борг.
--
-- Growth, а не OPEX — рішення власника від 03.08. OPEX це буфер під оренду й
-- закупівлю, його заниження ризикує реальним платежем; Growth дискреційний.
--
-- Суму НЕ зашито: береться фактичний мінус на момент запуску. Якщо сейф уже в
-- нулі, міграція нічого не робить — її можна ганяти повторно.
--
-- Баланси пишуться ВИКЛЮЧНО через `safe_apply` — інваріант, здобутий міграціями
-- 20260729120100…20260729121000. Пряме `update safes set balance` тут було б
-- зручнішим і зламало б його.
--
-- CHECK на невід'ємні половини вмикається ОКРЕМОЮ міграцією ПІСЛЯ цієї. Порядок
-- критичний, і в репозиторії вже є прецедент: 20260729121000_safe_halves_check
-- вмикав свій CHECK останнім із тієї ж причини.

do $$
declare
  v_np    public.safes%rowtype;
  v_adv   public.safes%rowtype;
  v_owner uuid;
  v_debt  integer;
begin
  select * into v_np  from public.safes where type = 'net_profit';
  select * into v_adv from public.safes where type = 'growth';

  if v_np.id is null then
    raise exception 'Сейф чистого прибутку не знайдено';
  end if;
  if v_adv.id is null then
    raise exception 'Сейф Growth не знайдено — нема з чого списувати аванс';
  end if;

  v_debt := -v_np.balance_cash;

  if v_debt <= 0 then
    raise notice 'Готівкова половина сейфа «%» не в мінусі (%). Бекфіл не потрібен.',
      v_np.name, v_np.balance_cash;
    return;
  end if;

  -- Безготівку цей бекфіл не покриває: аванс брали купюрами, і перекладати
  -- безготівковий мінус тим самим записом було б вигадкою.
  if v_np.balance_cashless < 0 then
    raise exception 'Безготівкова половина сейфа «%» теж у мінусі (%) — цей бекфіл її не покриває',
      v_np.name, v_np.balance_cashless;
  end if;

  if v_adv.balance_cash < v_debt then
    raise exception 'У сейфі «%» лише % грн готівкою, а перекласти треба %',
      v_adv.name, v_adv.balance_cash, v_debt;
  end if;

  -- Автор — той, хто робив останнє вилучення з ЧП. Аванс проти нього і
  -- рахується, тож приписати його «невідомо кому» означало б загубити борг.
  select created_by into v_owner
    from public.transactions
   where reference_type = 'distribution'
     and to_type = 'external'
     and from_type = 'safe'
     and from_id = v_np.id
     and created_by is not null
   order by created_at desc
   limit 1;

  if v_owner is null then
    raise exception 'Не знайдено автора жодного вилучення з сейфа «%» — нема на кого записати аванс', v_np.name;
  end if;

  -- Запис 1: сторно. Для сторони `from` дельта балансу від'ємна від суми, тому
  -- від'ємна сума піднімає сейф.
  perform public.safe_apply(v_np.id, v_debt, 'cash');

  insert into public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, description, created_by, payment_method
  ) values (
    -v_debt, 'safe', v_np.id, 'external', null,
    'distribution',
    format('Сторно частини вилучення 01.08 «Дисплей Денісу»: %s грн перекладено в аванс власника', v_debt),
    v_owner, 'cash'
  );

  -- Запис 2: сам аванс. Сейф віддає рівно ту готівку, яку він і так фактично
  -- віддав купюрами 01.08.
  perform public.safe_apply(v_adv.id, -v_debt, 'cash');

  insert into public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, description, created_by, payment_method
  ) values (
    v_debt, 'safe', v_adv.id, 'external', null,
    'distribution',
    format('Аванс власника: %s грн з вилучення 01.08 «Дисплей Денісу», взяті наперед понад баланс сейфа ЧП', v_debt),
    v_owner, 'cash'
  );

  raise notice 'Перекладено % грн із сейфа «%» в аванс власника з сейфа «%»',
    v_debt, v_np.name, v_adv.name;
end $$;
