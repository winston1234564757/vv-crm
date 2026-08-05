import { cache } from "react";
import { createClient } from "./supabase/server";
import { supabaseCast } from "./utils/supabase";

/**
 * Таблиці, які на одній сторінці читають кілька завантажувачів одразу.
 *
 * `/admin/finance` збирає сім незалежних звітів, і кожен чесно тягне те, що
 * йому треба. На перетині виходило: `safes` — чотири рази, `cash_registers` —
 * чотири, `transactions` — тричі. Жоден із завантажувачів не помиляється; вони
 * просто не знають один про одного.
 *
 * `cache()` з React мемоїзує виклик у межах ОДНОГО рендера: перший звертається
 * до бази, решта отримують ту саму проміс-обгортку. Між запитами кеш не живе,
 * тож несвіжих даних тут не буває — `force-dynamic` на сторінці лишається
 * чинним, і після кожної дії числа перечитуються з нуля.
 *
 * Чому не звели все в один спільний завантажувач, як `profit-dataset.ts`:
 * там усі споживачі просять один і той самий зріз, тож спільна вибірка їм
 * природна. Тут звіти різні за суттю — рух грошей, міст, залишки — і
 * зшивати їх в один запит означало б зв'язати три несумісні відповідальності
 * заради економії, яку `cache()` дає безкоштовно.
 *
 * ВАЖЛИВО: ці функції повертають СПІЛЬНИЙ об'єкт. Мутувати результат не можна —
 * зміна дійде до всіх інших читачів у тому ж рендері.
 */

export interface RawTransaction {
  id: string;
  amount: number;
  from_type: string;
  from_id: string | null;
  to_type: string;
  to_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
  payment_method: string | null;
}

export interface RawSafe {
  id: string;
  name: string;
  type: string;
  balance: number;
  balance_cash: number | null;
  balance_cashless: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface RawRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

/**
 * Увесь реєстр. `*`, а не перелік колонок: `payment_method` немає в
 * згенерованих типах (`database.ts` навмисно не перегенеровується), а названа
 * в `.select()` невідома колонка ламає типізацію всього запиту.
 */
export const getAllTransactions = cache(async (): Promise<RawTransaction[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select("*");
  if (error) throw new Error(error.message);
  return supabaseCast<RawTransaction[]>(data ?? []);
});

export const getAllSafesRaw = cache(async (): Promise<RawSafe[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("safes").select("*");
  if (error) throw new Error(error.message);
  return supabaseCast<RawSafe[]>(data ?? []);
});

export const getAllRegistersRaw = cache(async (): Promise<RawRegister[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cash_registers").select("*");
  if (error) throw new Error(error.message);
  return supabaseCast<RawRegister[]>(data ?? []);
});
