/**
 * Рух грошей: чиста класифікація й підсумки, без Supabase і React.
 *
 * Це НЕ прибуток. Закупівля товару тут витрата, хоч у P&L вона нею не є;
 * вилучення частки власником тут витрата, хоч у P&L це його прибуток. Два
 * різні звіти, які ніколи не зводяться в одне число.
 */

export type MoveClass = "inflow" | "outflow" | "internal";

/** Рахунки магазину. Усе інше — «зовні». */
const ACCOUNTS = new Set(["cash_register", "safe"]);

/**
 * Що з боку власника, а не бізнесу: він кладе свої гроші й забирає свою
 * частку. Змішані з торгівлею, ці рухи ховають відповідь на головне питання —
 * чи бізнес сам себе годує.
 */
const OWNER_KINDS = new Set(["top_up", "distribution"]);

const LABELS: Record<string, string> = {
  sale: "Продажі",
  repair_payment: "Оплати ремонтів",
  client_order: "Передоплати замовлень",
  top_up: "Поповнення власником",
  inventory: "Закупівлі товару",
  accessory: "Аксесуари",
  expense: "Операційні витрати",
  distribution: "Вилучення частки",
};

export interface RawMove {
  amount: number;
  from_type: string;
  to_type: string;
  reference_type: string | null;
}

export interface FlowLine {
  key: string;
  label: string;
  amount: number;
  count: number;
  /** Рух власника, а не операційний. */
  owner: boolean;
}

export interface CashFlowSummary {
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
  /**
   * `actualClosing − (opening + inflow − outflow)`. Нуль — звірка зійшлась.
   * Ненульове означає, що баланс рахунку змінили в обхід леджера; це треба
   * показати, а не приховати.
   */
  drift: number;
  inflowLines: FlowLine[];
  outflowLines: FlowLine[];
  /** Заробив мінус витратив на роботу. Від'ємне — бізнес не годує себе сам. */
  operatingNet: number;
  /** Власник вніс мінус забрав. */
  ownerNet: number;
  /** Перекладання між своїми рахунками: не рух, але корисно знати обсяг. */
  internal: { count: number; total: number };
}

/**
 * Клас руху — за типами сторін, а НЕ за `reference_type`.
 *
 * `distribution` буває і внутрішнім переказом у сейф, і вилученням частки
 * назовні. Тип сторони розрізняє їх надійно, а список `reference_type`
 * довелось би доповнювати щоразу, коли з'явиться новий вид операції.
 *
 * Рух, у якого жодна сторона не є рахунком магазину, теж «внутрішній» — не
 * тому, що це переказ, а тому, що каси він не торкається і в потік не входить.
 */
export function classifyMove(m: RawMove): MoveClass {
  const fromUs = ACCOUNTS.has(m.from_type);
  const toUs = ACCOUNTS.has(m.to_type);
  if (fromUs && toUs) return "internal";
  if (toUs) return "inflow";
  if (fromUs) return "outflow";
  return "internal";
}

function toLines(bucket: Map<string, { amount: number; count: number }>): FlowLine[] {
  return [...bucket.entries()]
    .map(([key, v]) => ({
      key,
      label: LABELS[key] ?? key,
      amount: v.amount,
      count: v.count,
      owner: OWNER_KINDS.has(key),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function summarize(
  moves: RawMove[],
  opening: number,
  actualClosing: number,
): CashFlowSummary {
  const inBucket = new Map<string, { amount: number; count: number }>();
  const outBucket = new Map<string, { amount: number; count: number }>();
  let inflow = 0;
  let outflow = 0;
  let internalCount = 0;
  let internalTotal = 0;

  for (const m of moves) {
    const cls = classifyMove(m);
    if (cls === "internal") {
      // Рух, що не торкається кас, не рахуємо навіть у внутрішні: він не
      // перекладання, а сторонній запис.
      if (ACCOUNTS.has(m.from_type) && ACCOUNTS.has(m.to_type)) {
        internalCount += 1;
        internalTotal += m.amount;
      }
      continue;
    }
    const key = m.reference_type ?? "other";
    const bucket = cls === "inflow" ? inBucket : outBucket;
    const cur = bucket.get(key) ?? { amount: 0, count: 0 };
    cur.amount += m.amount;
    cur.count += 1;
    bucket.set(key, cur);
    if (cls === "inflow") inflow += m.amount;
    else outflow += m.amount;
  }

  const inflowLines = toLines(inBucket);
  const outflowLines = toLines(outBucket);
  const sum = (lines: FlowLine[], owner: boolean) =>
    lines.filter((l) => l.owner === owner).reduce((s, l) => s + l.amount, 0);

  return {
    opening,
    inflow,
    outflow,
    closing: actualClosing,
    drift: actualClosing - (opening + inflow - outflow),
    inflowLines,
    outflowLines,
    operatingNet: sum(inflowLines, false) - sum(outflowLines, false),
    ownerNet: sum(inflowLines, true) - sum(outflowLines, true),
    internal: { count: internalCount, total: internalTotal },
  };
}
