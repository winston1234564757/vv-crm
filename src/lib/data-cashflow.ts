import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import {
  summarize,
  type CashFlowSummary,
  type RawMove,
} from "./cashflow";
import { supabaseCast } from "./utils/supabase";
import { isCashless } from "@/lib/utils/finance";

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
  /**
   * Скільки з `closing` — це паперові купюри: готівкові каси плюс готівкові
   * половини сейфів. Саме це число власник перераховує руками, тож воно
   * мусить стояти на екрані окремо. Решта (`closing − banknotes`) лежить на
   * банківському рахунку, і в шухляді її немає.
   */
  banknotes: number;
}

export async function getCashFlow(): Promise<CashFlowReport> {
  const supabase = await createClient();
  const { finance_epoch } = await getSettings();

  const [txRes, crRes, safeRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, from_type, to_type, reference_type, created_at, description"),
    supabase.from("cash_registers").select("balance, type"),
    supabase.from("safes").select("*"),
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
    const move: RawMove = {
      amount: t.amount,
      from_type: t.from_type,
      to_type: t.to_type,
      reference_type: t.reference_type,
    };
    if (isBefore(t.created_at)) {
      if (t.to_type === "cash_register" || t.to_type === "safe") opening += t.amount;
      if (t.from_type === "cash_register" || t.from_type === "safe") opening -= t.amount;
    } else {
      moves.push(move);
    }
  }

  /* Загальний залишок — саме СУМА всього, без поділу на готівку й картку:
     тотожність із леджером не знає про способи оплати, і будь-який поділ їй
     лише завадив би. */
  const registers = supabaseCast<{ balance: number; type: string }[]>(crRes.data ?? []);
  const safes = supabaseCast<
    { balance: number; balance_cash: number | null }[]
  >(safeRes.data ?? []);

  const closing =
    registers.reduce((s, r) => s + r.balance, 0) + safes.reduce((s, r) => s + r.balance, 0);

  /* Купюри окремо — це те єдине число, яке власник може перерахувати руками.
     Готівкові каси плюс ГОТІВКОВІ половини сейфів; безготівковий рахунок і
     безготівкові половини сюди не входять, бо в шухляді їх немає.

     Половини `balance_cash` є в базі під CHECK-обмеженням, але у згенерованих
     типах їх немає (`database.ts` навмисно не перегенеровується), тому каст. */
  const banknotes =
    registers.filter((r) => !isCashless(r.type)).reduce((s, r) => s + r.balance, 0) +
    safes.reduce((s, r) => s + (r.balance_cash ?? r.balance), 0);

  return {
    ...summarize(moves, opening, closing),
    epoch: finance_epoch,
    banknotes,
  };
}
