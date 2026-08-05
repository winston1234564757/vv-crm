"use server";

import { requireRole } from "./utils/rbac";
import { MONEY_ROLES } from "./roles";
import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import { supabaseCast } from "./utils/supabase";

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
}

const EMPTY = (hint: string): DrillResult => ({ rows: [], total: 0, hint });

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

  const withTotal = (rows: DrillRow[], hint: string): DrillResult => ({
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    hint,
  });

  switch (key) {
    case "inventory": {
      const rows = await ledgerRows(
        (t) => INVENTORY_KINDS.has(t.reference_type ?? "") && isAccount(t.from_type),
        finance_epoch,
      );
      return withTotal(
        rows,
        "Усе, що пішло з рахунків на поповнення складу. У прибутку цих грошей немає, доки товар не проданий.",
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
      const rows = await ledgerRows((t) => t.reference_type === "adjustment", finance_epoch);
      return withTotal(
        rows,
        "Ручні списання й дозаписи, коли перерахунок купюр не збігся з базою.",
      );
    }

    case "receivables":
      return EMPTY("Продано й видано, гроші ще не зайшли. Зараз таких немає.");

    default:
      return EMPTY("Деталей для цієї статті немає.");
  }
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

  const withTotal = (rows: DrillRow[], hint: string): DrillResult => ({
    rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    hint,
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
