"use client";

import { format, isValid } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import { IconWarning } from "@/components/icons";
import { repairStatus, paymentStatus, repairSource } from "@/lib/domain-labels";
import { isUnpaid, outstanding } from "@/lib/repair-flow";
import type { Column, CardSpec } from "@/components/list/ListPageShell";
import { type RepairWithPayments, isOverdue } from "./repair-types";

function money(n: number) {
  return `${n.toLocaleString()} ₴`;
}

function shortId(id: string) {
  return id.substring(0, 8);
}

function fmtDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return isValid(d) ? format(d, "dd.MM.yyyy") : String(value);
}

/** The deadline, loud only when it has actually been missed. */
function Deadline({ r }: { r: RepairWithPayments }) {
  const text = fmtDate(r.estimated_completion);
  if (!text) return <span className="text-faint">—</span>;
  if (isOverdue(r)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
        <IconWarning size={12} />
        {text}
      </span>
    );
  }
  return <span className="tabular text-xs text-muted">{text}</span>;
}

/**
 * What the repair is worth and what is still owed. A warranty repair shows as
 * warranty rather than as 0 ₴ — the price is not the point, the reason is.
 */
function Money({ r }: { r: RepairWithPayments }) {
  if (r.is_warranty) return <Badge tone="accent">Гарантія</Badge>;
  const owed = outstanding(r, r.paid_amount);
  return (
    <div className="flex flex-col items-end">
      <span className="tabular font-medium">{money(r.price)}</span>
      {owed > 0 && <span className="tabular text-xs text-danger">борг {money(owed)}</span>}
    </div>
  );
}

export function repairColumns(): Column<RepairWithPayments>[] {
  return [
    {
      key: "id",
      header: "№",
      hideBelow: "lg",
      cell: (r) => <span className="tabular text-xs text-muted">{shortId(r.id)}</span>,
    },
    {
      key: "customer",
      header: "Клієнт",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.customer_name}</span>
          {r.customer_phone && (
            <span className="tabular text-xs text-muted">{r.customer_phone}</span>
          )}
        </div>
      ),
    },
    {
      key: "device",
      header: "Пристрій",
      cell: (r) => (
        <div className="flex flex-col">
          <span>{r.device_name}</span>
          <span className="max-w-[220px] truncate text-xs text-muted" title={r.issue}>
            {r.issue}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      cell: (r) => <StatusPill map={repairStatus} value={r.status} />,
    },
    {
      key: "payment",
      header: "Оплата",
      hideBelow: "md",
      cell: (r) =>
        r.is_warranty ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <StatusPill map={paymentStatus} value={r.payment_status} />
        ),
    },
    {
      key: "deadline",
      header: "Дедлайн",
      hideBelow: "md",
      cell: (r) => <Deadline r={r} />,
    },
    {
      key: "source",
      header: "Джерело",
      hideBelow: "lg",
      cell: (r) => <StatusPill map={repairSource} value={r.source} />,
    },
    {
      key: "price",
      header: "Вартість",
      align: "right",
      cell: (r) => <Money r={r} />,
    },
  ];
}

export function repairCard(r: RepairWithPayments): CardSpec {
  const owed = outstanding(r, r.paid_amount);
  const deadline = fmtDate(r.estimated_completion);

  return {
    title: r.customer_name,
    subtitle: `${r.device_name} · ${r.issue}`,
    state: <StatusPill map={repairStatus} value={r.status} />,
    rows: [
      {
        label: "Вартість",
        value: r.is_warranty ? <Badge tone="accent">Гарантія</Badge> : money(r.price),
      },
      ...(!r.is_warranty
        ? [
            {
              label: "Оплата",
              value: <StatusPill map={paymentStatus} value={r.payment_status} />,
            },
          ]
        : []),
      ...(owed > 0
        ? [{ label: "Залишок", value: <span className="text-danger">{money(owed)}</span> }]
        : []),
      ...(deadline
        ? [
            {
              label: "Дедлайн",
              value: isOverdue(r) ? (
                <span className="text-danger">{deadline} — прострочено</span>
              ) : (
                deadline
              ),
            },
          ]
        : []),
      ...(r.customer_phone ? [{ label: "Телефон", value: r.customer_phone }] : []),
    ],
    footer: isUnpaid(r) ? (
      <p className="flex items-center gap-1.5 text-xs text-warning">
        <IconWarning size={12} />
        Не оплачено — {money(owed)}
      </p>
    ) : undefined,
  };
}
