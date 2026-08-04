-- Частку прибутку можна знімати ЛИШЕ з сейфа «Чистий прибуток».
--
-- Раніше RPC приймала джерелом і касу. Через це нарахування довелось рахувати
-- від заробленого (50% чистого прибутку від епохи), бо база «скільки завели в
-- сейф» не бачила вилучень, які йшли повз сейф, і залишок ішов у мінус.
--
-- Тепер модель замкнена з іншого боку: нараховується з сейфа, знімається з
-- сейфа. Сума залишків обох власників дорівнює балансу сейфа — число, яке
-- перевіряється руками, а не на віру.
--
-- Сигнатура не змінюється: `source_type` лишається в параметрах, щоб не ламати
-- виклики, але приймає тільки 'safe', і тільки сейф типу net_profit.

CREATE OR REPLACE FUNCTION public.withdraw_owner_share(
  source_type TEXT,
  source_id UUID,
  amount NUMERIC,
  desc_text TEXT,
  user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance NUMERIC;
  source_name TEXT;
  safe_kind TEXT;
BEGIN
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Сума вилучення має бути більше 0';
  END IF;

  IF source_type <> 'safe' THEN
    RAISE EXCEPTION 'Частку можна зняти лише з сейфа «Чистий прибуток». Спершу розподіліть касу.';
  END IF;

  SELECT balance, name, type
    INTO current_balance, source_name, safe_kind
    FROM public.safes
   WHERE id = source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Сейф не знайдено';
  END IF;

  IF safe_kind <> 'net_profit' THEN
    RAISE EXCEPTION 'Сейф "%" не є сейфом чистого прибутку — частку з нього знімати не можна', source_name;
  END IF;

  IF current_balance < amount THEN
    RAISE EXCEPTION 'Недостатньо коштів у сейфі "%". Доступно: % грн', source_name, current_balance;
  END IF;

  UPDATE public.safes SET balance = balance - amount WHERE id = source_id;

  INSERT INTO public.transactions (
    amount,
    from_type,
    from_id,
    to_type,
    to_id,
    reference_type,
    description,
    created_by
  ) VALUES (
    amount,
    'safe',
    source_id,
    'external',
    NULL,
    'distribution',
    COALESCE(NULLIF(desc_text, ''), 'Вилучення частки прибутку співвласника'),
    user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_owner_share(TEXT, UUID, NUMERIC, TEXT, UUID) TO authenticated;
