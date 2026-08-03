-- Звірка безготівки з реальністю, 03.08.
--
-- Власник перерахував: купюр 16 000, на картці 9 750. Купюри система показувала
-- правильно. Безготівки в ній було 10 604 — 9 717 на касі безготівки плюс 887,
-- що числяться за сейфом Growth. Різниця 854 ₴ на користь системи.
--
-- Що перевірено перед цим записом:
--   * баланс і леджер сходяться по КОЖНІЙ касі й КОЖНОМУ сейфу, diff = 0.
--     Тобто записи між собою не суперечать — розходиться саме запис із життям;
--   * транзакції на 854 не існує, і зібрати її з наявних сум не виходить.
-- Отже гроші пішли з рахунку без запису. Відновити, на що саме, з бази не можна
-- і не буде можна: чого не записали, того там немає.
--
-- Тому це не «підгонка», а свідомий запис: різниця мусить лишити слід. Рядок
-- видно в русі коштів, він має тип `adjustment` і опис, який каже правду —
-- походження невідоме. Мовчки виправити баланс було б гірше: наступного разу
-- ніхто б не згадав, звідки взялось число.
--
-- Списується з КАСИ безготівки, а не з половини сейфа: каса — це те, що ще не
-- рознесене по сейфах, і зменшити її означає зменшити нерозподілене. Забрати
-- 854 з Growth означало б тихо порізати бюджет конкретного сейфа.
--
-- Поруч є окремий хвіст, який цим записом НЕ лікується: 31.07 SSD SanDisk 542
-- записаний двічі — о 15:48:34 закупівлею деталей і о 15:49:02 витратою, з
-- різницею 28 секунд. Якщо це справді дубль, система занижена ще на 542, і тоді
-- реально не записаних витрат не 854, а 1 396. Чіпати його наосліп не можна:
-- видалення закупівлі зніме зі складу товар, який там лежить.

do $$
declare
  v_reg     public.cash_registers%rowtype;
  v_owner   uuid;
  v_target  integer := 9750;  -- скільки на картці насправді, зі слів власника
  v_actual  integer;
  v_delta   integer;
begin
  select * into v_reg from public.cash_registers where type = 'cashless' for update;
  if v_reg.id is null then
    raise exception 'Каса безготівки не знайдена';
  end if;

  -- Уся безготівка: каса плюс безготівкові половини сейфів. Гроші там і там
  -- лежать на одному банківському рахунку — сейф лише каже, кому вони обіцяні.
  select v_reg.balance + coalesce(sum(balance_cashless), 0) into v_actual from public.safes;

  v_delta := v_actual - v_target;

  if v_delta = 0 then
    raise notice 'Безготівка вже дорівнює % — корекція не потрібна.', v_target;
    return;
  end if;

  if v_delta < 0 then
    raise exception 'У системі безготівки МЕНШЕ (%), ніж полічив власник (%). Цей запис уміє лише списувати — розберіться, звідки надлишок у житті.',
      v_actual, v_target;
  end if;

  if v_reg.balance < v_delta then
    raise exception 'На касі «%» лише % грн, а списати треба %. Списувати з половини сейфа цей запис не має права.',
      v_reg.name, v_reg.balance, v_delta;
  end if;

  select id into v_owner from public.profiles where role = 'owner' order by created_at limit 1;

  update public.cash_registers
     set balance = balance - v_delta,
         updated_at = now()
   where id = v_reg.id;

  insert into public.transactions (
    amount, from_type, from_id, to_type, to_id,
    reference_type, description, created_by, payment_method
  ) values (
    v_delta, 'cash_register', v_reg.id, 'external', null,
    'adjustment',
    format('Звірка безготівки 03.08: у системі було %s грн, власник полічив на картці %s. Різниця %s грн — витрата без запису, походження невідоме.',
           v_actual, v_target, v_delta),
    v_owner, 'cashless'
  );

  raise notice 'Списано % грн: безготівка % → %', v_delta, v_actual, v_target;
end $$;
