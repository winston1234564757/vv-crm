"use client";

import { Badge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import { IconWarning } from "@/components/icons";
import { deviceCondition, deviceType, deviceSource } from "@/lib/domain-labels";
import { deviceStage, stageLabels, stageTones, type StageResult } from "@/lib/device-stage";
import type { Column, CardSpec } from "@/components/list/ListPageShell";
import { type DeviceWithRepairs, totalCostOf, profitOf } from "./device-types";

function money(n: number) {
  return `${n.toLocaleString()} ₴`;
}

export function stageOf(d: DeviceWithRepairs): StageResult {
  return deviceStage(d, d.repairs);
}

function StageBadge({ d }: { d: DeviceWithRepairs }) {
  const { stage } = stageOf(d);
  return <Badge tone={stageTones[stage]}>{stageLabels[stage]}</Badge>;
}

/**
 * The discrepancies `deviceStage` had to paper over, shown rather than
 * resolved. Merging the two repair models is a data migration over money
 * records and is deliberately not part of this redesign.
 */
function Discrepancies({ d, compact = false }: { d: DeviceWithRepairs; compact?: boolean }) {
  const { discrepancies } = stageOf(d);
  if (discrepancies.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {discrepancies.map((x) => (
        <Badge key={x.code} tone="warning" title={x.detail}>
          <IconWarning size={11} />
          {compact ? null : x.label}
        </Badge>
      ))}
    </span>
  );
}

function deviceName(d: DeviceWithRepairs) {
  return [d.brand, d.model].filter(Boolean).join(" ") || "Без назви";
}

function deviceSpec(d: DeviceWithRepairs) {
  return [d.storage, d.color].filter(Boolean).join(" · ");
}

/**
 * Columns for the active stages. Money is right-aligned and tabular; the
 * archive adds the realised-profit column instead of the expected one.
 */
export function activeColumns(): Column<DeviceWithRepairs>[] {
  return [
    {
      key: "device",
      header: "Пристрій",
      cell: (d) => (
        <div className="flex flex-col">
          <span className="font-medium">{deviceName(d)}</span>
          {deviceSpec(d) && <span className="text-xs text-muted">{deviceSpec(d)}</span>}
        </div>
      ),
    },
    {
      key: "imei",
      header: "IMEI",
      hideBelow: "lg",
      cell: (d) => <span className="tabular text-xs text-muted">{d.imei || "—"}</span>,
    },
    {
      key: "condition",
      header: "Стан",
      hideBelow: "md",
      cell: (d) => <StatusPill map={deviceCondition} value={d.condition_grade} />,
    },
    {
      key: "stage",
      header: "Етап",
      cell: (d) => (
        <div className="flex flex-col items-start gap-1">
          <StageBadge d={d} />
          <Discrepancies d={d} />
        </div>
      ),
    },
    {
      key: "cost",
      header: "Вкладено",
      align: "right",
      hideBelow: "lg",
      cell: (d) => <span className="tabular text-muted">{money(totalCostOf(d))}</span>,
    },
    {
      key: "price",
      header: "Ціна",
      align: "right",
      cell: (d) => <span className="tabular font-medium">{money(d.price)}</span>,
    },
    {
      key: "margin",
      header: "Очік. маржа",
      align: "right",
      hideBelow: "md",
      cell: (d) => {
        const p = profitOf(d);
        return (
          <span className={`tabular font-medium ${p < 0 ? "text-danger" : "text-success"}`}>
            {money(p)}
          </span>
        );
      },
    },
  ];
}

export function archiveColumns(): Column<DeviceWithRepairs>[] {
  return [
    {
      key: "device",
      header: "Пристрій",
      cell: (d) => (
        <div className="flex flex-col">
          <span className="font-medium">{deviceName(d)}</span>
          {deviceSpec(d) && <span className="text-xs text-muted">{deviceSpec(d)}</span>}
        </div>
      ),
    },
    {
      key: "imei",
      header: "IMEI",
      hideBelow: "lg",
      cell: (d) => <span className="tabular text-xs text-muted">{d.imei || "—"}</span>,
    },
    {
      key: "stage",
      header: "Стан обліку",
      cell: (d) => (
        <div className="flex flex-col items-start gap-1">
          <StageBadge d={d} />
          <Discrepancies d={d} />
        </div>
      ),
    },
    {
      key: "cost",
      header: "Вкладено",
      align: "right",
      hideBelow: "md",
      cell: (d) => <span className="tabular text-muted">{money(totalCostOf(d))}</span>,
    },
    {
      key: "price",
      header: "Продано за",
      align: "right",
      cell: (d) => <span className="tabular font-medium">{money(d.price)}</span>,
    },
    {
      key: "profit",
      header: "Прибуток",
      align: "right",
      cell: (d) => {
        const p = profitOf(d);
        const ros = d.price > 0 ? Math.round((p / d.price) * 100) : 0;
        return (
          <div className="flex flex-col items-end">
            <span className={`tabular font-medium ${p < 0 ? "text-danger" : "text-success"}`}>
              {money(p)}
            </span>
            <span className="tabular text-xs text-muted">{ros}%</span>
          </div>
        );
      },
    },
    {
      key: "date",
      header: "Оновлено",
      align: "right",
      hideBelow: "lg",
      cell: (d) => (
        <span className="tabular text-xs text-muted">
          {new Date(d.updated_at).toLocaleDateString("uk-UA")}
        </span>
      ),
    },
  ];
}

/** One card spec for every stage — the mobile projection of the row. */
export function deviceCard(d: DeviceWithRepairs): CardSpec {
  const { discrepancies } = stageOf(d);
  const p = profitOf(d);
  const isArchived = ["sold", "returned", "archived"].includes(d.status);

  return {
    title: deviceName(d),
    subtitle: deviceSpec(d) || d.imei || undefined,
    state: <StageBadge d={d} />,
    rows: [
      { label: "Вкладено", value: money(totalCostOf(d)) },
      {
        label: isArchived ? "Продано за" : "Ціна",
        value: money(d.price),
      },
      {
        label: isArchived ? "Прибуток" : "Очікувана маржа",
        value: <span className={p < 0 ? "text-danger" : "text-success"}>{money(p)}</span>,
      },
      ...(d.condition_grade
        ? [
            {
              label: "Стан",
              value: <StatusPill map={deviceCondition} value={d.condition_grade} />,
            },
          ]
        : []),
      ...(d.source
        ? [{ label: "Джерело", value: <StatusPill map={deviceSource} value={d.source} /> }]
        : []),
      ...(d.type
        ? [{ label: "Категорія", value: <StatusPill map={deviceType} value={d.type} /> }]
        : []),
    ],
    footer:
      discrepancies.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {discrepancies.map((x) => (
            <p key={x.code} className="flex items-start gap-1.5 text-xs text-warning">
              <IconWarning size={12} />
              <span>
                <span className="font-medium">{x.label}.</span>{" "}
                <span className="text-muted">{x.detail}</span>
              </span>
            </p>
          ))}
        </div>
      ) : undefined,
  };
}
