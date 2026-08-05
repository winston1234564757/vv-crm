"use server";

import { requireRole } from "./utils/rbac";
import { MONEY_ROLES } from "./roles";
import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import { supabaseCast } from "./utils/supabase";
import {
  allocateSaleRevenue,
  itemCost,
  floorAtEpoch,
  resolveRange,
  isRangePreset,
  type ProfitSaleItem,
  type ProfitDeviceCost,
} from "./profit";

/** Рядок позиції чека у формі, яку чекає рушій. */
type ProfitItem = ProfitSaleItem & { item_id: string | null };

/**
 * Що стоїть за числом: список операцій, з яких воно склалось.
 *
 * Кожен рядок містка «прибуток → гроші» і кожна стаття вартості бізнесу — це
 * підсумок десятків рухів, і донедавна він був кінцевою точкою: цифру видно,
 * перевірити нічим. Для звіту, за яким двоє власників ділять гроші, це погано
 * саме по собі — число, яке не можна розкрити, доводиться приймати на віру.
 *
 * Тягнеться НА ВІДКРИТТЯ модалки, а не разом зі сторінкою: деталі всіх
 * дванадцяти статей — це кілька тисяч рядків, які майже завжди нікому не
 * потрібні. Сторінка лишається легкою, а платить лише той, хто справді клікнув.
 */

export interface DrillRow {
  id: string;
  /** ISO або вже готова дата — рендериться як є. */
  date: string | null;
  title: string;
  subtitle?: string | null;
  amount: number;
}

export interface DrillResult {
  rows: DrillRow[];
  total: number;
  /** Пояснення статті — те саме, що раніше займало пів таблиці колонкою «ЧОМУ». */
  hint: string;
  /**
   * Чому підсумок списку НЕ дорівнює числу, з якого модалку відкрили.
   *
   * Потрібно рівно там, де стаття містка — це різниця двох потоків, а не сам
   * потік: «Осіло в товарі» дорівнює закупівлям мінус списана собівартість, і
   * показати можна лише закупівлі. Мовчати про це не можна — підсумок, що
   * суперечить заголовку, підриває довіру до всієї сторінки. `null` означає,
   * що сходиться точно.
   */
  reconcile: string | null;
}

const EMPTY = (hint: string): DrillResult => ({ rows: [], total: 0, hint, reconcile: null });

/** Рухи реєстру за типом посилання, з підписаними сторонами. */
async function ledgerRows(
  filter: (t: LedgerTx) => boolean,
  epochIso: string | null,
): Promise<DrillRow[]> {
  const supabase = await createClient();

  const [txRes, safeRes, regRes] = await Promise.all([
    supabase.from("transactions").select("*"),
    supabase.from("safes").select("id, name"),
    supabase.from("cash_registers").select("id, name"),
  ]);
  if (txRes.error) throw new Error(txRes.error.message);

  const names = new Map<string, string>();
  for (const s of safeRes.data ?? []) names.set(s.id, s.name);
  for (const r of regRes.data ?? []) names.set(r.id, r.name);

  const epochMs = epochIso ? new Date(epochIso).getTime() : null;

  return supabaseCast<LedgerTx[]>(txRes.data ?? [])
    .filter((t) => (epochMs === null ? true : new Date(t.created_at).getTime() >= epochMs))
    .filter(filter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((t) => ({
      id: t.id,
      date: t.created_at,
      title: t.description?.trim() || sideLabel(t, names),
      subtitle: t.description?.trim() ? sideLabel(t, names) : null,
      amount: t.amount,
    }));
}

interface LedgerTx {
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
}

const SIDE_LABELS: Record<string, string> = {
  customer: "Клієнт",
  supplier: "Постачальник",
  external: "Назовні",
};

function sideLabel(t: LedgerTx, names: Map<string, string>): string {
  const side = (type: string, id: string | null) =>
    (id && names.get(id)) || SIDE_LABELS[type] || type;
  return `${side(t.from_type, t.from_id)} → ${side(t.to_type, t.to_id)}`;
}

const INVENTORY_KINDS = new Set(["inventory", "device", "part", "accessory", "purchase"]);

export async function getBridgeLineRows(key: string): Promise<DrillResult> {
  await requireRole(MONEY_ROLES);
  const supabase = await createClient();
  const { finance_epoch } = await getSettings();

  const withTotal = (rows: DrillRow[], hint: string, reconcile: string | null = null): DrillResult => ({
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    hint,
    reconcile,
  });

  switch (key) {
    case "inventory": {
      const rows = await ledgerRows(
        (t) => INVENTORY_KINDS.has(t.reference_type ?? "") && isAccount(t.from_type),
        finance_epoch,
      );
      const bought = rows.reduce((s, r) => s + r.amount, 0);
      const written = await cogsSinceEpoch(finance_epoch);
      const delta = bought - written;

      return withTotal(
        rows,
        "Усе, що пішло з рахунків на поповнення складу. У прибутку цих грошей немає, доки товар не проданий.",
        `Рядок містка — це НЕ ця сума, а різниця двох потоків: закуплено ${bought.toLocaleString("uk-UA")} ₴, списано в собівартість проданого ${Math.round(written).toLocaleString("uk-UA")} ₴, різниця ${Math.abs(Math.round(delta)).toLocaleString("uk-UA")} ₴ ${delta > 0 ? "осіла в товарі" : "вивільнилась із товару"}.`,
      );
    }

    case "deferred": {
      const { data: repairs } = await supabase
        .from("repairs")
        .select("id, status")
        .not("status", "in", "(handed_over,cancelled)");
      const undelivered = new Set((repairs ?? []).map((r) => r.id));
      const rows = await ledgerRows(
        (t) =>
          (t.reference_type === "repair_payment" &&
            !!t.reference_id &&
            undelivered.has(t.reference_id)) ||
          (t.reference_type === "client_order" && isAccount(t.to_type)),
        finance_epoch,
      );
      return withTotal(
        rows,
        "Ремонти, за які заплатили, але ще не забрали, і передоплати замовлень. Гроші вже в касі, виторгом стануть на видачі.",
      );
    }

    case "payables": {
      const { data } = await supabase
        .from("parts")
        .select("*")
        .eq("payment_status", "deferred");
      const rows = supabaseCast<
        { id: string; name: string; debt_amount: number | null; payment_due_date: string | null }[]
      >(data ?? []).map((p) => ({
        id: p.id,
        date: p.payment_due_date,
        title: p.name,
        subtitle: p.payment_due_date ? "оплатити до" : null,
        amount: p.debt_amount ?? 0,
      }));
      return withTotal(rows, "Товар у нас, гроші постачальнику ще не пішли.");
    }

    case "capital": {
      const settings = await getSettings();
      const { data } = await supabase
        .from("expenses")
        .select("id, amount, description, paid_at, category_id, paid_from_safe_id")
        .eq("category_id", settings.capital_category_id ?? "");
      const npSafe = await netProfitSafeId();
      const rows = (data ?? [])
        .filter((e) => e.paid_from_safe_id !== npSafe)
        .map((e) => ({
          id: e.id,
          date: e.paid_at,
          title: e.description || "Без опису",
          amount: e.amount,
        }));
      return withTotal(
        rows,
        "Обладнання й запуск. Свідомо не входять у прибуток, але з каси пішли.",
      );
    }

    case "owner_in": {
      const rows = await ledgerRows((t) => t.reference_type === "top_up", finance_epoch);
      return withTotal(rows, "Особисті гроші власників, докладені в бізнес. Це не заробіток.");
    }

    case "owner_out": {
      const npSafe = await netProfitSafeId();
      const ledger = await ledgerRows(
        (t) => t.reference_type === "distribution" && t.to_type === "external",
        finance_epoch,
      );
      // Витрати з сейфа ЧП — те саме вилучення, лише в іншій обгортці.
      const { data: npExpenses } = await supabase
        .from("expenses")
        .select("id, amount, description, paid_at, paid_from_safe_id")
        .eq("paid_from_safe_id", npSafe ?? "");
      const extra = (npExpenses ?? []).map((e) => ({
        id: e.id,
        date: e.paid_at,
        title: e.description || "Витрата з сейфа ЧП",
        subtitle: "оплачено з чистого прибутку",
        amount: e.amount,
      }));
      return withTotal(
        [...ledger, ...extra].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
        "Забрана власниками частка — і прямі вилучення, і витрати, оплачені з сейфа чистого прибутку.",
      );
    }

    case "adjustments": {
      const raw = await ledgerRows((t) => t.reference_type === "adjustment", finance_epoch);
      // Знак, як у містку: списання з рахунку зменшує касу. Без цього підсумок
      // модалки був би дзеркальним до числа, з якого її відкрили.
      const signed = await signByDirection(raw);
      return withTotal(
        signed,
        "Ручні списання й дозаписи, коли перерахунок купюр не збігся з базою.",
      );
    }

    case "receivables":
      return EMPTY("Продано й видано, гроші ще не зайшли. Зараз таких немає.");

    /* Опорні рядки ланцюга. Вони не «стаття» — це те, з чого починається й чим
       закінчується міст, тож і показують не вибірку, а весь потік. */
    case "__profit":
      return profitRows(finance_epoch);

    case "__actual":
      return cashChangeRows(finance_epoch);

    default:
      return EMPTY("Деталей для цієї статті немає.");
  }
}

/**
 * Усе, що склало прибуток: продажі за ВИЗНАНИМ виторгом і зданi ремонти.
 *
 * Виторг чека береться через `allocateSaleRevenue` — той самий розподіл знижки,
 * що й у рушії. Якби тут стояла сума рядків, список не зійшовся б із числом над
 * ним рівно на знижку, і заглиблення спростовувало б підсумок замість
 * підтверджувати.
 */
async function profitRows(epochIso: string | null): Promise<DrillResult> {
  const supabase = await createClient();
  const epoch = epochIso ?? "1970-01-01T00:00:00Z";

  const [salesRes, repairsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, created_at, total_amount, notes, sale_items(item_type, item_id, quantity, unit_cost, total_price)")
      .eq("status", "completed")
      .gte("created_at", epoch),
    supabase
      .from("repairs")
      .select("id, price, cost, external_sc_cost, device_name, completed_at, status, inventory_device_id")
      .is("inventory_device_id", null)
      .eq("status", "handed_over")
      .gte("completed_at", epoch),
  ]);
  if (salesRes.error) throw new Error(salesRes.error.message);
  if (repairsRes.error) throw new Error(repairsRes.error.message);

  const sales = supabaseCast<
    {
      id: string;
      created_at: string;
      total_amount: number;
      notes: string | null;
      sale_items: ProfitItem[];
    }[]
  >(salesRes.data ?? []);

  const devices = await deviceCosts(
    sales.flatMap((s) =>
      (s.sale_items ?? []).filter((i) => i.item_type === "device" && i.item_id).map((i) => i.item_id!),
    ),
  );

  const saleRows: DrillRow[] = sales.map((s) => {
    const items = s.sale_items ?? [];
    const revenue = allocateSaleRevenue(items, s.total_amount).reduce((a, b) => a + b, 0);
    const cost = items.reduce((sum, i) => sum + itemCost(i, devices), 0);
    return {
      id: s.id,
      date: s.created_at,
      title: s.notes?.trim() || `Продаж · ${items.length} поз.`,
      subtitle: `виторг ${revenue.toLocaleString("uk-UA")} − собівартість ${Math.round(cost).toLocaleString("uk-UA")}`,
      amount: Math.round(revenue - cost),
    };
  });

  const repairRows: DrillRow[] = supabaseCast<
    {
      id: string;
      price: number;
      cost: number;
      external_sc_cost: number;
      device_name: string | null;
      completed_at: string;
    }[]
  >(repairsRes.data ?? []).map((r) => ({
    id: r.id,
    date: r.completed_at,
    title: r.device_name || "Ремонт",
    subtitle: `ціна ${r.price.toLocaleString("uk-UA")} − деталі ${(r.cost + r.external_sc_cost).toLocaleString("uk-UA")}`,
    amount: r.price - r.cost - r.external_sc_cost,
  }));

  /* Операційні витрати ТЕЖ у списку, від'ємними рядками. Без них підсумок
     показав би валовий прибуток, а над модалкою стоїть чистий — і заглиблення
     спростовувало б число, замість підтверджувати його. Виключення ті самі,
     що в рушії: капітальні витрати й оплачені з сейфа ЧП — це не операційка,
     вони окремими статтями містка. */
  const settings = await getSettings();
  const npSafe = await netProfitSafeId();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, amount, description, paid_at, created_at, category_id, paid_from_safe_id")
    .gte("created_at", epoch);

  const expenseRows: DrillRow[] = (expenses ?? [])
    .filter((e) => e.category_id !== settings.capital_category_id)
    .filter((e) => e.paid_from_safe_id !== npSafe)
    .map((e) => ({
      id: e.id,
      date: e.paid_at ?? e.created_at,
      title: e.description || "Витрата",
      subtitle: "операційна витрата",
      amount: -e.amount,
    }));

  const rows = [...saleRows, ...repairRows, ...expenseRows].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  return {
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    hint:
      "Кожна операція за своїм внеском у прибуток: продажі й ремонти за визнаним виторгом мінус собівартість, і операційні витрати від'ємними рядками. Знижка по чеку вже рознесена по позиціях, як у рушії.",
    reconcile: null,
  };
}

/** Усі рухи, що торкнулись кас і сейфів. Знак — напрям. */
async function cashChangeRows(epochIso: string | null): Promise<DrillResult> {
  const rows = await ledgerRows(
    (t) => isAccount(t.from_type) || isAccount(t.to_type),
    epochIso,
  );
  const signed = await signByDirection(rows);
  // Перекладання між своїми рахунками касу не змінює: один бік дає, другий бере.
  const visible = signed.filter((r) => r.amount !== 0);

  return {
    rows: visible,
    total: visible.reduce((s, r) => s + r.amount, 0),
    hint:
      "Кожен рух, що торкнувся каси чи сейфа. Перекладання між своїми рахунками не показані — вони касу не змінюють.",
    reconcile: null,
  };
}

/**
 * Проставляє знак за напрямом: з рахунку — мінус, на рахунок — плюс, між
 * своїми — нуль. Спільне для звірок і для приросту грошей, бо правило одне.
 */
async function signByDirection(rows: DrillRow[]): Promise<DrillRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("transactions").select("id, from_type, to_type");
  const dir = new Map((data ?? []).map((t) => [t.id, { from: t.from_type, to: t.to_type }]));

  return rows.map((r) => {
    const d = dir.get(r.id);
    if (!d) return r;
    if (isAccount(d.from) && isAccount(d.to)) return { ...r, amount: 0 };
    if (isAccount(d.from)) return { ...r, amount: -r.amount };
    return r;
  });
}

/** Собівартість усього списаного з епохи: продані товари плюс деталі в ремонтах. */
async function cogsSinceEpoch(epochIso: string | null): Promise<number> {
  const supabase = await createClient();
  const epoch = epochIso ?? "1970-01-01T00:00:00Z";

  const [salesRes, repairsRes] = await Promise.all([
    supabase
      .from("sales")
      .select("id, sale_items(item_type, item_id, quantity, unit_cost, total_price)")
      .eq("status", "completed")
      .gte("created_at", epoch),
    supabase
      .from("repairs")
      .select("cost, external_sc_cost")
      .is("inventory_device_id", null)
      .eq("status", "handed_over")
      .gte("completed_at", epoch),
  ]);

  const sales = supabaseCast<{ sale_items: ProfitItem[] }[]>(salesRes.data ?? []);
  const devices = await deviceCosts(
    sales.flatMap((s) =>
      (s.sale_items ?? []).filter((i) => i.item_type === "device" && i.item_id).map((i) => i.item_id!),
    ),
  );

  const goods = sales.reduce(
    (sum, s) => sum + (s.sale_items ?? []).reduce((a, i) => a + itemCost(i, devices), 0),
    0,
  );
  const repairs = (repairsRes.data ?? []).reduce(
    (sum, r) => sum + r.cost + r.external_sc_cost,
    0,
  );

  return goods + repairs;
}

function isAccount(t: string): boolean {
  return t === "cash_register" || t === "safe";
}

async function netProfitSafeId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("safes").select("id, type").eq("type", "net_profit");
  return data?.[0]?.id ?? null;
}

/* ── Вартість бізнесу ────────────────────────────────────────────────────── */

export async function getWorthPartRows(key: string): Promise<DrillResult> {
  await requireRole(MONEY_ROLES);
  const supabase = await createClient();

  const withTotal = (rows: DrillRow[], hint: string, reconcile: string | null = null): DrillResult => ({
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    hint,
    reconcile,
  });

  switch (key) {
    case "registers": {
      const { data } = await supabase.from("cash_registers").select("id, name, balance, type");
      return withTotal(
        (data ?? []).map((r) => ({ id: r.id, date: null, title: r.name, amount: r.balance })),
        "Гроші в касах — те, що ще не рознесене по сейфах.",
      );
    }

    case "safes": {
      const { data } = await supabase.from("safes").select("*");
      const rows = supabaseCast<
        { id: string; name: string; balance: number; balance_cash: number | null }[]
      >(data ?? []).map((s) => ({
        id: s.id,
        date: null,
        title: s.name,
        subtitle: `з них купюрами ${(s.balance_cash ?? s.balance).toLocaleString("uk-UA")} ₴`,
        amount: s.balance,
      }));
      return withTotal(rows, "Резерви по сейфах: операційний, розвитку і чистого прибутку.");
    }

    case "devices": {
      const { data } = await supabase
        .from("devices")
        .select("id, brand, model, cost_price, repair_cost, status")
        .in("status", ["in_stock", "service", "transit"]);
      const rows = (data ?? []).map((d) => ({
        id: d.id,
        date: null,
        title: [d.brand, d.model].filter(Boolean).join(" ") || "Без назви",
        subtitle:
          d.repair_cost > 0
            ? `закупка ${d.cost_price.toLocaleString("uk-UA")} + ремонт ${d.repair_cost.toLocaleString("uk-UA")}`
            : null,
        amount: d.cost_price + d.repair_cost,
      }));
      return withTotal(
        rows.sort((a, b) => b.amount - a.amount),
        "Техніка на складі за СОБІВАРТІСТЮ разом із вкладеним ремонтом, а не за цінником.",
      );
    }

    case "accessories": {
      const { data } = await supabase
        .from("accessories")
        .select("id, name, cost_price, stock")
        .gt("stock", 0);
      const rows = (data ?? []).map((a) => ({
        id: a.id,
        date: null,
        title: a.name,
        subtitle: `${a.stock} шт × ${a.cost_price.toLocaleString("uk-UA")} ₴`,
        amount: a.cost_price * a.stock,
      }));
      return withTotal(
        rows.sort((a, b) => b.amount - a.amount),
        "Аксесуари на складі за собівартістю.",
      );
    }

    case "parts": {
      const { data } = await supabase
        .from("parts")
        .select("id, name, cost_price, stock")
        .gt("stock", 0);
      const rows = (data ?? []).map((p) => ({
        id: p.id,
        date: null,
        title: p.name,
        subtitle: `${p.stock} шт × ${p.cost_price.toLocaleString("uk-UA")} ₴`,
        amount: p.cost_price * p.stock,
      }));
      return withTotal(
        rows.sort((a, b) => b.amount - a.amount),
        "Запчастини на складі за собівартістю.",
      );
    }

    case "payables":
      return getBridgeLineRows("payables");

    default:
      return EMPTY("Деталей для цієї статті немає.");
  }
}

/* ── Позиція каталогу ────────────────────────────────────────────────────── */

/**
 * Усі продажі однієї позиції.
 *
 * `key` — той самий `${item_type}:${item_id}`, яким `topSellers` групує рядки,
 * тож заглиблення потрапляє рівно в те, що показано в таблиці.
 *
 * Виторг рядка — з розподілу знижки по чеку, а не `total_price`: інакше сума
 * заглиблення розійшлась би з числом, під яким воно відкрилось.
 */
export async function getSkuSaleRows(key: string, preset: string): Promise<DrillResult> {
  await requireRole(MONEY_ROLES);
  const supabase = await createClient();
  const { finance_epoch } = await getSettings();

  const [itemType, itemId] = key.split(":");
  if (!itemType || !itemId || itemId === "unknown") {
    return EMPTY("Позицію видалено з каталогу — історію продажів по ній не відновити.");
  }

  const range = resolveRange(isRangePreset(preset) ? preset : "30d", new Date());
  const window = floorAtEpoch(range.start, range.end, finance_epoch);
  if (window.empty) return EMPTY("Обраний період повністю до початку обліку.");

  const { data, error } = await supabase
    .from("sales")
    .select("id, created_at, total_amount, notes, sale_items(item_type, item_id, quantity, unit_cost, total_price)")
    .eq("status", "completed")
    .gte("created_at", window.start.toISOString())
    .lt("created_at", window.end.toISOString());
  if (error) throw new Error(error.message);

  const sales = supabaseCast<
    { id: string; created_at: string; total_amount: number; notes: string | null; sale_items: ProfitItem[] }[]
  >(data ?? []);

  const devices = await deviceCosts([itemId]);
  const rows: DrillRow[] = [];

  for (const s of sales) {
    const items = s.sale_items ?? [];
    const revenues = allocateSaleRevenue(items, s.total_amount);

    items.forEach((item, i) => {
      if (item.item_type !== itemType || item.item_id !== itemId) return;
      const cost = itemCost(item, devices);
      const revenue = revenues[i];
      rows.push({
        id: `${s.id}-${i}`,
        date: s.created_at,
        title: s.notes?.trim() || "Продаж",
        subtitle: `${item.quantity} шт · виторг ${Math.round(revenue).toLocaleString("uk-UA")} − собівартість ${Math.round(cost).toLocaleString("uk-UA")}`,
        amount: Math.round(revenue),
      });
    });
  }

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return {
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    hint:
      "Кожен чек, у якому ця позиція продавалась. Виторг — уже з рознесеною знижкою, тож сума внизу збігається з числом у таблиці.",
    reconcile: null,
  };
}

/** Собівартість девайсів для `itemCost`: cost_price + вкладений ремонт. */
async function deviceCosts(ids: string[]): Promise<Map<string, ProfitDeviceCost>> {
  const map = new Map<string, ProfitDeviceCost>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select("id, cost_price, repair_cost")
    .in("id", unique);

  for (const d of data ?? []) map.set(d.id, { cost_price: d.cost_price, repair_cost: d.repair_cost });
  return map;
}
