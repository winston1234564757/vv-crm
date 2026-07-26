import { createClient } from "./supabase/server";
import { supabaseCast } from "@/lib/utils/supabase";
import { daysBetween, statusSince, type AttentionRepair, type AttentionStockItem } from "./attention";
import { isUnpaid, type RepairStatus } from "./repair-flow";
import { repairStatus as repairStatusLabels } from "./domain-labels";
import { dayKey } from "./utils/day";
import type { OrderStatus } from "@/types/orders";

/**
 * Стан майстерні й замовлень ПРЯМО ЗАРАЗ.
 *
 * Свідомо не приймає діапазону дат: черга, готові до видачі й замовлення —
 * це поточний стан, а не період. «Черга ремонтів за минулий місяць» не має
 * змісту, тому таблист періодів на дашборді ці блоки не чіпає.
 *
 * Тут же живе вибірка для блоку «Потребує уваги»: він читає ті самі рядки
 * `repairs`, і тримати два однакові запити означало б платити двічі за одне.
 * Рішення (`findAttention`) лишається в чистому `lib/attention.ts`.
 */

/** Скільки рядків показуємо в операційній картці; решта — за кліком. */
export const TOP_ROWS = 3;

/** Порядок воронки — робочий цикл ремонту, не алфавіт. */
export const QUEUE_STATUSES: RepairStatus[] = [
  "received",
  "diagnostics",
  "in_progress",
  "awaiting_parts",
  "ready",
  "completed",
];

export interface QueueBucket {
  status: RepairStatus;
  label: string;
  count: number;
}

export interface PickupRow {
  id: string;
  device: string;
  customer: string;
  /** Скільки днів лежить у поточному статусі. */
  days: number;
  /** Скільки клієнт ще винен. Нуль, якщо оплачено або гарантія. */
  debt: number;
}

export interface OrderRow {
  id: string;
  no: string;
  customer: string;
  status: OrderStatus;
  deadline: string | null;
  /** Дедлайн уже минув, а замовлення не видане. */
  overdue: boolean;
}

export interface OperationsData {
  queue: QueueBucket[];
  /** Скільки ремонтів у роботі всього (усі нетермінальні статуси). */
  queueTotal: number;
  pickup: {
    rows: PickupRow[];
    total: number;
    /** Сума боргів по ВСІХ готових до видачі, не лише по показаних. */
    debt: number;
  };
  orders: {
    rows: OrderRow[];
    total: number;
    arrived: number;
    ready: number;
    overdue: number;
  };
  /** Сирі рядки для `findAttention` — рішення лишається на клієнті. */
  attention: { repairs: AttentionRepair[]; stock: AttentionStockItem[] };
}

const PICKUP_STATUSES = new Set<RepairStatus>(["ready", "completed"]);

/** Статуси, у яких замовлення ще чекає дії. `new` теж рахуємо активним. */
const OPEN_ORDER_STATUSES = ["new", "ordered", "arrived", "ready"] satisfies OrderStatus[];

interface RepairRow {
  id: string;
  device_name: string;
  status: string;
  price: number;
  payment_status: string | null;
  is_warranty: boolean | null;
  created_at: string;
  inventory_device_id: string | null;
  customers: { name: string } | null;
  repair_status_log: { created_at: string }[] | null;
}

export async function getOperationsData(): Promise<OperationsData> {
  const supabase = await createClient();
  const now = new Date();

  const [repairsRes, accessoriesRes, partsRes, ordersRes] = await Promise.all([
    supabase
      .from("repairs")
      .select(
        "id, device_name, status, price, payment_status, is_warranty, created_at, inventory_device_id, customers(name), repair_status_log(created_at)",
      ),
    supabase.from("accessories").select("id, name, stock, min_stock").eq("status", "active"),
    supabase.from("parts").select("id, name, stock, min_stock"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("client_orders")
      .select("id, order_no, status, deadline, customers(name)")
      .in("status", OPEN_ORDER_STATUSES)
      .order("deadline", { ascending: true, nullsFirst: false }),
  ]);

  const repairs = supabaseCast<RepairRow[]>(repairsRes.data ?? []);

  // Блок уваги дивиться на всі ремонти, включно зі складськими — саме він
  // ловить «виданий, але не оплачений». Операційні картки — лише зовнішні.
  const attentionRepairs: AttentionRepair[] = repairs.map((r) => ({
    id: r.id,
    device_name: r.device_name,
    status: r.status,
    created_at: r.created_at,
    inventory_device_id: r.inventory_device_id,
    payment_status: r.payment_status,
    last_log_at: (r.repair_status_log ?? []).reduce<string | null>(
      (max, log) => (!max || log.created_at > max ? log.created_at : max),
      null,
    ),
  }));

  const external = repairs.filter((r) => !r.inventory_device_id);

  const counts = new Map<string, number>();
  for (const r of external) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);

  const queue: QueueBucket[] = QUEUE_STATUSES.map((status) => ({
    status,
    label: repairStatusLabels[status]?.label ?? status,
    count: counts.get(status) ?? 0,
  }));
  const queueTotal = queue.reduce((s, b) => s + b.count, 0);

  const pickupRepairs = external.filter((r) => PICKUP_STATUSES.has(r.status as RepairStatus));

  // Точний борг: `payment_status` — це лише кеш реєстру, і для «partial» він
  // не знає, скільки саме внесли. Гроші беремо з самих платежів.
  const paidById = new Map<string, number>();
  if (pickupRepairs.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select("amount, reference_id")
      .eq("reference_type", "repair_payment")
      .in(
        "reference_id",
        pickupRepairs.map((r) => r.id),
      );
    for (const t of data ?? []) {
      if (!t.reference_id) continue;
      paidById.set(t.reference_id, (paidById.get(t.reference_id) ?? 0) + t.amount);
    }
  }

  const sinceById = new Map(attentionRepairs.map((a) => [a.id, statusSince(a)]));

  const pickupAll: PickupRow[] = pickupRepairs
    .map((r) => ({
      id: r.id,
      device: r.device_name,
      customer: r.customers?.name ?? "—",
      days: daysBetween(sinceById.get(r.id) ?? r.created_at, now),
      debt: isUnpaid({
        price: r.price,
        payment_status: r.payment_status,
        is_warranty: r.is_warranty,
      })
        ? Math.max(0, r.price - (paidById.get(r.id) ?? 0))
        : 0,
    }))
    // Найдовше чекають — угору: саме їх треба видати першими.
    .sort((a, b) => b.days - a.days);

  const orderRows = supabaseCast<
    {
      id: string;
      order_no: string;
      status: OrderStatus;
      deadline: string | null;
      customers: { name: string } | null;
    }[]
  >(ordersRes.data ?? []);

  const todayKey = dayKey(now);
  const orders: OrderRow[] = orderRows.map((o) => ({
    id: o.id,
    no: o.order_no,
    customer: o.customers?.name ?? "—",
    status: o.status,
    deadline: o.deadline,
    overdue: !!o.deadline && o.deadline < todayKey && o.status !== "ready",
  }));

  const stock: AttentionStockItem[] = [
    ...(accessoriesRes.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      stock: a.stock,
      min_stock: a.min_stock,
      kind: "accessory" as const,
    })),
    ...(partsRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      min_stock: p.min_stock,
      kind: "part" as const,
    })),
  ];

  return {
    queue,
    queueTotal,
    pickup: {
      rows: pickupAll.slice(0, TOP_ROWS),
      total: pickupAll.length,
      debt: pickupAll.reduce((s, r) => s + r.debt, 0),
    },
    orders: {
      rows: orders.slice(0, TOP_ROWS),
      total: orders.length,
      arrived: orders.filter((o) => o.status === "arrived").length,
      ready: orders.filter((o) => o.status === "ready").length,
      overdue: orders.filter((o) => o.overdue).length,
    },
    attention: { repairs: attentionRepairs, stock },
  };
}
