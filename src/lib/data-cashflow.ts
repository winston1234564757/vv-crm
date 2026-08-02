import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import { summarize, type CashFlowSummary, type RawMove } from "./cashflow";

/**
 * Рух грошей від фінансової епохи.
 *
 * Джерело — `transactions`, і тільки воно. Ніякого `profit.ts`: прибуток і рух
 * грошей це два різні звіти, які не зводяться в одне число.
 *
 * «Від відкриття» не означає «з нуля»: до епохи магазин торгував «з рук», і
 * той залишок лежить у касах досі. Без нього тотожність не зійшлася б.
 */
export interface CashFlowReport extends CashFlowSummary {
  /** Дата епохи для підпису. `null` — межі немає. */
  epoch: string | null;
}

export async function getCashFlow(): Promise<CashFlowReport> {
  const supabase = await createClient();
  const { finance_epoch } = await getSettings();

  const [txRes, crRes, safeRes] = await Promise.all([
    supabase.from("transactions").select("amount, from_type, to_type, reference_type, created_at"),
    supabase.from("cash_registers").select("balance"),
    supabase.from("safes").select("balance"),
  ]);

  // Помилки не ковтаємо: зламаний запит і порожній період інакше виглядали б
  // однаково, і звірка «зійшлась» була б неправдою.
  if (txRes.error) throw new Error(txRes.error.message);
  if (crRes.error) throw new Error(crRes.error.message);
  if (safeRes.error) throw new Error(safeRes.error.message);

  const all = txRes.data ?? [];
  const epochMs = finance_epoch ? new Date(finance_epoch).getTime() : null;
  const isBefore = (iso: string) => epochMs !== null && new Date(iso).getTime() < epochMs;

  /* Залишок на момент епохи — чиста дельта всіх рухів до неї. Внутрішні
     перекази тут самі гасяться: один бік дає +, другий −. */
  let opening = 0;
  const moves: RawMove[] = [];
  for (const t of all) {
    if (isBefore(t.created_at)) {
      if (t.to_type === "cash_register" || t.to_type === "safe") opening += t.amount;
      if (t.from_type === "cash_register" || t.from_type === "safe") opening -= t.amount;
    } else {
      moves.push({
        amount: t.amount,
        from_type: t.from_type,
        to_type: t.to_type,
        reference_type: t.reference_type,
      });
    }
  }

  /* Загальний залишок — саме СУМА всього, без поділу на готівку й картку.
     `splitByKind` тут ні до чого: він існує, щоб не змішати каси різних типів
     у «готівку», а тут потрібен один підсумок для звірки з леджером, і
     будь-який поділ їй лише завадив би. */
  const closing =
    (crRes.data ?? []).reduce((s, { balance }) => s + balance, 0) +
    (safeRes.data ?? []).reduce((s, { balance }) => s + balance, 0);

  return { ...summarize(moves, opening, closing), epoch: finance_epoch };
}
