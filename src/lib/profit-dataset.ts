/**
 * Одна вибірка даних для рушія прибутку: продажі з позиціями, закриті ремонти,
 * витрати, собівартості проданих пристроїв, каси й спліт-оплати.
 *
 * Живе окремо від `data-dashboard.ts`, бо ту саму вибірку тепер потребує і
 * сторінка Днів, а тримати її приватною в модулі дашборду означало б або
 * дублювати запити, або експортувати внутрішню деталь модуля, який і без того
 * робить забагато.
 */
import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import {
  toDatedRepairs,
  REPAIR_PNL_COLUMNS,
  type DatedExpense,
  type DatedRepair,
  type DatedSale,
  type ProfitDataset,
  type ProfitDeviceCost,
  type RepairPnlRow,
  type ProfitSaleItem,
} from "./profit";

export interface LoadedDataset {
  dataset: ProfitDataset;
  cashRegisters: { id: string; name: string; balance: number; type: string }[];
  /**
   * Спліт-оплати продажів, ключ — `sales.id`. Живе окремо від `DatedSale`
   * (тип спільний з `lib/profit`, який про оплати нічого не знає) — потрібні
   * лише для розбивки готівка/картка.
   */
  paymentSplitsBySale: Map<string, { amount: number; method: string }[]>;
}

/**
 * Дашборду треба одні й ті самі гроші в шести розрізах. Раніше кожен розріз
 * ходив у базу окремо: `profitForRange` викликалась до чотирьох разів по
 * два-три запити, стільки ж разів рахувались витрати, а `getDailyShares`
 * поверх усього сканував продажі/ремонти/витрати від епохи без верхньої межі —
 * запит, який росте лінійно, скільки б магазин не працював.
 *
 * Тепер рядки тягнуться один раз за вікно `datasetWindowStart`, а всі розрізи
 * ріжуться з них у пам'яті через `lib/profit`. Три послідовні стадії замість
 * ~18 роунд-тріпів, і рушій прибутку лишається рівно один — денний ряд під
 * графіком не може розійтися з KPI над ним.
 */
export async function loadDataset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: Date,
  end: Date,
): Promise<LoadedDataset> {
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  const empty = start >= end;

  const [salesRes, repairsRes, expensesRes, cashRes] = await Promise.all([
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from("sales")
          .select(
            "id, created_at, total_amount, sale_items(item_type, item_id, quantity, unit_cost, total_price), payment_splits(amount, method)",
          )
          // Повернений продаж — це продаж, якого не було. `refund_sale`
          // (`20260628000004`) ставить статус, але лишає `total_amount` і всі
          // `sale_items` на місці, тож без цього фільтра повернення назавжди
          // завищувало б і виторг, і собівартість, і прибуток на кожному екрані.
          // Повернень у базі поки 0 — фільтр стоїть до першого, а не після.
          .eq("status", "completed")
          .gte("created_at", startStr)
          .lt("created_at", endStr),
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from("repairs")
          .select(REPAIR_PNL_COLUMNS)
          .is("inventory_device_id", null)
          // Ремонт закривається видачею, тож грубий фільтр — по її даті.
          // Статус перевіряє `toDatedRepairs`: там одне правило на всю систему.
          .gte("completed_at", startStr)
          .lt("completed_at", endStr),
    empty
      ? Promise.resolve({ data: [] })
      : supabase
          .from("expenses")
          .select("created_at, amount, category_id, paid_from_safe_id")
          .gte("created_at", startStr)
          .lt("created_at", endStr),
    supabase.from("cash_registers").select("balance, id, name, type"),
  ]);

  const salesData = supabaseCast<
    {
      id: string;
      created_at: string;
      total_amount: number;
      sale_items: ProfitSaleItem[] | null;
      payment_splits: { amount: number; method: string }[] | null;
    }[]
  >(salesRes.data ?? []);

  // Собівартість пристрою — `cost_price + repair_cost`, а не `unit_cost` чека,
  // тож мапу треба добрати окремим запитом. Він залежить від списку продажів,
  // тому єдиний, що не влазить у Promise.all вище.
  const deviceIds = new Set<string>();
  for (const sale of salesData) {
    for (const item of sale.sale_items ?? []) {
      if (item.item_type === "device" && item.item_id) deviceIds.add(item.item_id);
    }
  }

  const devices = new Map<string, ProfitDeviceCost>();
  if (deviceIds.size > 0) {
    const { data } = await supabase
      .from("devices")
      .select("id, cost_price, repair_cost")
      .in("id", [...deviceIds]);
    for (const d of data ?? []) {
      devices.set(d.id, { cost_price: d.cost_price, repair_cost: d.repair_cost });
    }
  }

  const sales: DatedSale[] = salesData.map((s) => ({
    id: s.id,
    created_at: s.created_at,
    total_amount: s.total_amount,
    items: s.sale_items ?? [],
  }));

  const paymentSplitsBySale = new Map<string, { amount: number; method: string }[]>();
  for (const s of salesData) {
    paymentSplitsBySale.set(s.id, s.payment_splits ?? []);
  }

  const repairs: DatedRepair[] = toDatedRepairs(
    supabaseCast<RepairPnlRow[]>(repairsRes.data ?? []),
    start,
    end,
  );

  const expenses: DatedExpense[] = (expensesRes.data ?? []).map((e) => ({
    created_at: e.created_at,
    amount: e.amount,
    category_id: e.category_id,
    paid_from_safe_id: e.paid_from_safe_id,
  }));

  return {
    dataset: { sales, repairs, expenses, devices, windowStart: start },
    cashRegisters: cashRes.data ?? [],
    paymentSplitsBySale,
  };
}
