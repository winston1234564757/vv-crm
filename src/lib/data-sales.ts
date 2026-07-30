import { createClient } from "./supabase/server";
import { supabaseCast } from "./utils/supabase";
import { getSettings } from "./data-settings";
import {
  DEFAULT_SALES_SCOPE as SCOPE_DEFAULT,
  type SalesDir,
  type SalesScope,
  type SalesSort,
} from "./sales-list-params";

export interface SaleWithDetails {
  id: string;
  customer_id: string | null;
  total_amount: number;
  /**
   * ВІДСОТОК, не гривні: `total_amount = subtotal − round(subtotal × discount/100)`.
   * Годиться показати («Знижка 10%»), але рахувати гроші з нього не можна —
   * знижка в гривнях це `сума позицій − total_amount`, і лише вона вірна для
   * обох шляхів продажу (POS кладе позиції до знижки, швидкий продаж — після).
   */
  discount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  sale_type: string | null;
  delivery_needed: boolean | null;
  delivery_address: string | null;
  delivery_tracking: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  status: string;
  return_reason: string | null;
  monobank_payment_id: string | null;
  partner_id: string | null;
  promo_code_used: string | null;
  is_warranty?: boolean | null;
  customer_name: string;
  customer_phone: string;
  seller_name: string;
  items: Array<{
    id: string;
    sale_id: string;
    item_type: "device" | "accessory" | "part" | "service";
    item_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    name: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    method: "cash" | "card" | "transfer";
    cash_register_id: string;
    register_name: string;
  }>;
}

interface DbSaleItem {
  id: string;
  sale_id: string;
  item_type: "device" | "accessory" | "part" | "service";
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DbPaymentSplit {
  id: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  cash_register_id: string;
  cash_registers?: { name: string } | null;
}

interface DbSaleRow {
  id: string;
  customer_id: string | null;
  total_amount: number;
  discount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  sale_type: string | null;
  delivery_needed: boolean | null;
  delivery_address: string | null;
  delivery_tracking: string | null;
  warranty_start: string | null;
  warranty_end: string | null;
  status: string;
  return_reason: string | null;
  monobank_payment_id: string | null;
  partner_id: string | null;
  promo_code_used: string | null;
  customers: { name: string; phone: string } | null;
  profiles: { full_name: string | null; role: string | null } | null;
  sale_items: DbSaleItem[] | null;
  payment_splits: DbPaymentSplit[] | null;
}

export async function getSales(limit?: number, ids?: string[]): Promise<SaleWithDetails[]> {
  const supabase = await createClient();

  // Called with an explicit (possibly empty) id list — nothing to fetch.
  if (ids && ids.length === 0) return [];

  // 1. Fetch sales, customers, and seller profile
  let query = supabase
    .from("sales")
    .select(`
      *,
      customers(name, phone),
      profiles:created_by(full_name, role),
      sale_items(*),
      payment_splits(*, cash_registers(name))
    `)
    .order("created_at", { ascending: false });

  if (ids) {
    query = query.in("id", ids);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data: salesData, error: salesError } = await query;

  if (salesError) throw salesError;
  if (!salesData) return [];

  const typedSalesData = supabaseCast<DbSaleRow[]>(salesData);

  // 2. Gather all catalog item IDs to fetch names in bulk
  const deviceIds: string[] = [];
  const accessoryIds: string[] = [];
  const partIds: string[] = [];
  const serviceIds: string[] = [];

  typedSalesData.forEach((sale) => {
    (sale.sale_items || []).forEach((item) => {
      if (item.item_type === "device") {
        deviceIds.push(item.item_id);
      } else if (item.item_type === "accessory") {
        accessoryIds.push(item.item_id);
      } else if (item.item_type === "part") {
        partIds.push(item.item_id);
      } else if (item.item_type === "service") {
        serviceIds.push(item.item_id);
      }
    });
  });

  // Fetch names in parallel
  const [devicesRes, accessoriesRes, partsRes, servicesRes] = await Promise.all([
    deviceIds.length > 0
      ? supabase.from("devices").select("id, brand, model").in("id", deviceIds)
      : Promise.resolve({ data: [] }),
    accessoryIds.length > 0
      ? supabase.from("accessories").select("id, name").in("id", accessoryIds)
      : Promise.resolve({ data: [] }),
    partIds.length > 0
      ? supabase.from("parts").select("id, name").in("id", partIds)
      : Promise.resolve({ data: [] }),
    serviceIds.length > 0
      ? supabase.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] })
  ]);

  const deviceMap = new Map<string, string>(
    ((devicesRes.data as Array<{ id: string; brand: string | null; model: string | null }>) || []).map((d) => [
      d.id,
      `${d.brand || ""} ${d.model || ""}`.trim() || "Пристрій"
    ])
  );

  const accessoryMap = new Map<string, string>(
    ((accessoriesRes.data as Array<{ id: string; name: string | null }>) || []).map((a) => [a.id, a.name || "Аксесуар"])
  );

  const partMap = new Map<string, string>(
    ((partsRes.data as Array<{ id: string; name: string | null }>) || []).map((p) => [p.id, p.name || "Запчастина"])
  );

  const serviceMap = new Map<string, string>(
    ((servicesRes.data as Array<{ id: string; name: string | null }>) || []).map((s) => [s.id, s.name || "Послуга"])
  );

  // 3. Map the polymorphic names to items and construct full data structure
  return typedSalesData.map((sale) => {
    const items = (sale.sale_items || []).map((item) => {
      let name = "Невідомий товар";
      if (item.item_type === "device") {
        name = deviceMap.get(item.item_id) || "Пристрій (видалено)";
      } else if (item.item_type === "accessory") {
        name = accessoryMap.get(item.item_id) || "Аксесуар (видалено)";
      } else if (item.item_type === "part") {
        name = partMap.get(item.item_id) || "Запчастина (видалено)";
      } else if (item.item_type === "service") {
        name = serviceMap.get(item.item_id) || "Послуга (видалено)";
      }
      return { ...item, name };
    });

    const payments = (sale.payment_splits || []).map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      cash_register_id: p.cash_register_id,
      register_name: p.cash_registers?.name || "Каса"
    }));

    return {
      id: sale.id,
      customer_id: sale.customer_id,
      total_amount: sale.total_amount,
      discount: sale.discount,
      notes: sale.notes,
      created_by: sale.created_by,
      created_at: sale.created_at,
      sale_type: sale.sale_type,
      delivery_needed: sale.delivery_needed,
      status: sale.status || "completed",
      delivery_address: sale.delivery_address,
      delivery_tracking: sale.delivery_tracking,
      warranty_start: sale.warranty_start,
      warranty_end: sale.warranty_end,
      return_reason: sale.return_reason,
      monobank_payment_id: sale.monobank_payment_id,
      partner_id: sale.partner_id,
      promo_code_used: sale.promo_code_used,
      customer_name: sale.customers?.name ?? "Роздрібний покупець",
      customer_phone: sale.customers?.phone ?? "",
      seller_name: sale.profiles?.full_name ?? "Система",
      items,
      payments
    };
  });
}

export async function getSalesStats() {
  const supabase = await createClient();
  
  // Get all sales total_amount
  const { data, error } = await supabase
    .from("sales")
    .select("total_amount");

  if (error) throw error;

  const totalSales = data?.length ?? 0;
  const totalRevenue = data?.reduce((sum, s) => sum + s.total_amount, 0) ?? 0;
  const averageCheck = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;

  return {
    totalSales,
    totalRevenue,
    averageCheck
  };
}

// ---------------------------------------------------------------------------
// Server-side pagination & analytics
//
// Search, filtering and paging happen in Postgres (search_transactions), which
// returns one page of (kind, id) plus the total match count across BOTH sales
// and repairs. The rows themselves are then loaded per kind, so all the
// item-name / payment / seller resolution above stays in one place.
// ---------------------------------------------------------------------------

/* Розбір параметрів списку — у `sales-list-params`: його читає і клієнтська
   таблиця, а цей модуль тягне серверний Supabase. Ре-експорт, щоб виклики
   сторінки не роздвоювались на два імпорти. */
export {
  DEFAULT_SALES_SCOPE,
  parseSalesSort,
  parseSalesDir,
  parseSalesScope,
} from "./sales-list-params";
export type { SalesSort, SalesDir, SalesScope } from "./sales-list-params";

export interface SalesPageParams {
  page?: number;
  pageSize?: number;
  query?: string;
  category?: string;
  payment?: string;
  sort?: SalesSort;
  dir?: SalesDir;
  scope?: SalesScope;
}

/**
 * Ремонт у списку продажів.
 *
 * Навмисно вужчий за `RepairWithPayments`: сторінка продажів показує гроші й
 * те, за що вони взяті, а не робочий процес ремонту. Керувати ремонтом далі —
 * на сторінці Ремонтів.
 */
export interface SoldRepair {
  id: string;
  completed_at: string;
  customer_name: string;
  device_name: string;
  issue: string | null;
  price: number;
  payment_status: string | null;
  warranty_months: number | null;
  is_warranty: boolean | null;
}

/** Рядок спільної хронології: або товарний продаж, або зароблений ремонт. */
export type SalesRow =
  | { kind: "sale"; sale: SaleWithDetails }
  | { kind: "repair"; repair: SoldRepair };

interface TransactionHit {
  kind: "sale" | "repair";
  row_id: string;
  occurred_at: string;
  /** Сума операції: `total_amount` продажу або `price` ремонту. */
  amount: number;
  total_count: number;
}

export async function getSalesPage(params: SalesPageParams = {}): Promise<{
  rows: SalesRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(params.pageSize ?? 25, 1), 100);
  const requestedPage = Math.max(params.page ?? 1, 1);
  const sort = params.sort ?? "date";
  const dir = params.dir ?? "desc";
  const scope = params.scope ?? SCOPE_DEFAULT;

  /* Епоха читається тут, а не приходить параметром: сторінці не потрібно знати
     дату, їй достатньо сказати «від відкриття». `finance_epoch` може бути не
     заданий — тоді межі просто немає, і поведінка та сама, що в `all`. */
  const epoch = scope === "since_open" ? (await getSettings()).finance_epoch : null;

  // Порядок і межа — у Postgres, і це принципово: пагінація серверна, тож
  // сортування в React упорядкувало б лише поточну сторінку, а не всі операції.
  // @ts-expect-error - search_transactions is missing from database.ts types
  const { data, error } = await supabase.rpc("search_transactions", {
    p_query: params.query?.trim() || undefined,
    p_category: params.category && params.category !== "all" ? params.category : undefined,
    p_payment: params.payment && params.payment !== "all" ? params.payment : undefined,
    p_limit: pageSize,
    p_offset: (requestedPage - 1) * pageSize,
    p_from: epoch ?? undefined,
    p_sort: sort,
    p_dir: dir,
  });
  if (error) throw new Error(error.message);
  const hits = supabaseCast<TransactionHit[]>(data ?? []);
  const total = hits.length > 0 ? Number(hits[0].total_count) : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Page drifted past the end (e.g. rows deleted) — fall back to the last page.
  if (hits.length === 0 && total > 0 && requestedPage > pageCount) {
    return getSalesPage({ ...params, page: pageCount, pageSize });
  }

  const saleIds = hits.filter((h) => h.kind === "sale").map((h) => h.row_id);
  const repairIds = hits.filter((h) => h.kind === "repair").map((h) => h.row_id);

  const [sales, repairs] = await Promise.all([
    saleIds.length > 0 ? getSales(undefined, saleIds) : Promise.resolve([]),
    getSoldRepairs(repairIds),
  ]);

  /* Порядок задає Postgres — це єдине місце, де обидва джерела впорядковані
     спільним ключем (датою або сумою). Перебираємо hits, а не склеюємо два
     масиви: `getSales` віддає свої рядки за власним `created_at desc`, тож
     склейка зламала б і хронологію на межі сторінки, і сортування за сумою. */
  const byId = new Map<string, SalesRow>();
  for (const s of sales) byId.set(s.id, { kind: "sale", sale: s });
  for (const r of repairs) byId.set(r.id, { kind: "repair", repair: r });
  const rows = hits.map((h) => byId.get(h.row_id)).filter((r): r is SalesRow => !!r);

  return { rows, total, page: Math.min(requestedPage, pageCount), pageSize, pageCount };
}

async function getSoldRepairs(ids: string[]): Promise<SoldRepair[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repairs")
    .select("id, completed_at, device_name, issue, price, payment_status, warranty_months, is_warranty, customers(name)")
    .in("id", ids);
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    // Відбір у search_transactions гарантує completed_at; порожній рядок тут —
    // лише щоб не тягнути null у тип, який його не потребує.
    completed_at: r.completed_at ?? "",
    customer_name: (r.customers as { name: string } | null)?.name ?? "Роздрібний клієнт",
    device_name: r.device_name,
    issue: r.issue,
    price: r.price,
    payment_status: r.payment_status,
    warranty_months: r.warranty_months,
    is_warranty: r.is_warranty,
  }));
}

export type SalesBucket = "hour" | "day" | "month";

export interface SalesAnalyticsResult {
  revenue: number;
  count: number;
  warrantyCount: number;
  avgCheck: number;
  /**
   * Сума `byCategory` — знаменник для відсотків у розбивці, не окреме число
   * для екрана. Дорівнює `revenue`: RPC розподіляє знижку чека по позиціях,
   * тож категорії сходяться з оборотом. Плитки з цим числом більше немає —
   * вона була сумою позицій ДО знижок і читалась як розбіжність із оборотом.
   */
  itemsTotal: number;
  byCategory: Array<{ key: string; value: number }>;
  byPayment: Array<{ key: string; value: number }>;
  bySeller: Array<{ key: string; value: number }>;
  trend: Array<{ bucket: string; value: number }>;
  /**
   * Фактичний початок вікна після підняття до епохи, або `null` якщо запитане
   * вікно й так починалось після відкриття. UI підписує ним період, щоб
   * «30 днів», які насправді рахують дев'ять, не виглядали як тридцять.
   */
  flooredFrom: string | null;
}

/**
 * Зведення для шапки сторінки Продажів.
 *
 * Нижня межа піднімається до `finance_epoch` — так само, як це вже робив
 * список операцій під цими плитками. Без цього два числа на одному екрані
 * рахували різне: у списку було 33 операції від відкриття, а в плитці 36,
 * бо в «30 днів» потрапляли ще й дотестові продажі «з рук» на 6 350 ₴.
 */
export async function getSalesAnalytics(
  from: Date | null,
  to: Date | null,
  bucket: SalesBucket = "day",
): Promise<SalesAnalyticsResult> {
  const empty: SalesAnalyticsResult = {
    revenue: 0, count: 0, warrantyCount: 0, avgCheck: 0, itemsTotal: 0,
    byCategory: [], byPayment: [], bySeller: [], trend: [], flooredFrom: null,
  };

  const epochIso = (await getSettings()).finance_epoch;
  const epoch = epochIso ? new Date(epochIso) : null;
  const epochValid = epoch && !Number.isNaN(epoch.getTime()) ? epoch : null;

  /* «Увесь час» (`from === null`) теж починається з відкриття: без межі туди
     затікає та сама дотестова торгівля. */
  const start = epochValid && (!from || epochValid > from) ? epochValid : from;
  const flooredFrom = epochValid && (!from || epochValid > from) ? epochValid.toISOString() : null;

  // Вікно цілком до відкриття — наприклад «Минулий місяць» у перший місяць
  // роботи. Нулі чесніші за дотестові числа, і базу смикати нема за чим.
  if (start && to && start >= to) return { ...empty, flooredFrom };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_analytics", {
    p_from: start?.toISOString(),
    p_to: to?.toISOString(),
    p_bucket: bucket,
  });
  if (error) throw new Error(error.message);

  // sales_analytics returns jsonb, so its shape is opaque to the generated types.
  return { ...empty, ...((data as Partial<SalesAnalyticsResult> | null) ?? {}), flooredFrom };
}
