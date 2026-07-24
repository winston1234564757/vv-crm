"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  CATEGORY_LABELS,
  PROFIT_CATEGORIES,
  type CategoryProfit,
  type ProfitCategory,
} from "@/lib/profit";

/**
 * Дві плитки P&L — Валовий дохід і Собівартість & Витрати — тепер клікабельні:
 * кожна відкриває модалку з розкладкою рівно тих чисел, що стоять на плитці.
 *
 * Джерело даних — той самий `report.byCategory` / `report.categoryBreakdown`,
 * що й лічильники (див. lib/profit). Тому підсумок модалки завжди дорівнює
 * числу на плитці: ніякого другого способу порахувати ті самі гроші.
 */

const CATEGORY_COLOR: Record<ProfitCategory, string> = {
  device: "var(--color-violet)",
  accessory: "var(--color-cyan)",
  part: "var(--color-amber)",
  service: "var(--color-iris)",
  repair: "var(--color-emerald)",
};

interface Props {
  totalSales: number;
  repairsRevenue: number;
  salesCost: number;
  repairsCost: number;
  totalExpenses: number;
  byCategory: CategoryProfit[];
  categoryBreakdown: { name: string; amount: number }[];
}

interface Row {
  key: string;
  label: string;
  amount: number;
  color: string;
  /** Ціла маржа у відсотках — лише для рядків доходу. */
  margin?: number;
}

function money(v: number): string {
  return `${v.toLocaleString()} ₴`;
}

/** Один рядок списку зі смужкою частки від підсумку. */
function BreakdownRow({ row, total, accent }: { row: Row; total: number; accent: string }) {
  const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-text-primary">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="font-medium">{row.label}</span>
          {row.margin != null && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
                row.margin >= 0 ? "bg-emerald/10 text-emerald" : "bg-rose/10 text-rose"
              }`}
            >
              {row.margin >= 0 ? "+" : ""}
              {row.margin}%
            </span>
          )}
        </span>
        <span className="shrink-0 font-mono font-semibold text-text-primary">{money(row.amount)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-warm-border">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
        </div>
        <span className="w-8 shrink-0 text-right font-mono text-[9px] text-text-muted">{pct}%</span>
      </div>
    </div>
  );
}

/** Клікабельна плитка-лічильник. Візуал успадковано з page.tsx, додано лише курсор і hover. */
function MeterTile({
  label,
  total,
  accentClass,
  left,
  right,
  fillPct,
  fillClass,
  onClick,
}: {
  label: string;
  total: number;
  accentClass: string;
  left: string;
  right: string;
  fillPct: number;
  fillClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group space-y-1.5 rounded-[var(--radius-md)] -mx-2 px-2 py-1.5 text-left transition-colors hover:bg-warm-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 cursor-pointer"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-text-secondary">
          {label}
          <span className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </span>
        <span className={`font-semibold ${accentClass}`}>{money(total)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-warm-border">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${fillPct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[9px] text-text-muted">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </button>
  );
}

export function PLBreakdownPanel({
  totalSales,
  repairsRevenue,
  salesCost,
  repairsCost,
  totalExpenses,
  byCategory,
  categoryBreakdown,
}: Props) {
  const [open, setOpen] = useState<null | "income" | "cost">(null);

  const grossIncome = totalSales + repairsRevenue;
  const totalCost = salesCost + repairsCost + totalExpenses;
  const cogsTotal = salesCost + repairsCost;

  const byCat = new Map(byCategory.map((c) => [c.category, c]));

  // Дохід по категоріях — лише ненульові, у фіксованому порядку профіт-модуля.
  const incomeRows: Row[] = PROFIT_CATEGORIES.map((cat): Row | null => {
    const c = byCat.get(cat);
    if (!c || c.revenue <= 0) return null;
    return {
      key: cat,
      label: CATEGORY_LABELS[cat],
      amount: c.revenue,
      color: CATEGORY_COLOR[cat],
      margin: c.margin,
    };
  }).filter((r): r is Row => r !== null);

  // Собівартість реалізації по категоріях — теж лише ненульові.
  const cogsRows: Row[] = PROFIT_CATEGORIES.map((cat): Row | null => {
    const c = byCat.get(cat);
    if (!c || c.cost <= 0) return null;
    return { key: cat, label: CATEGORY_LABELS[cat], amount: c.cost, color: CATEGORY_COLOR[cat] };
  }).filter((r): r is Row => r !== null);

  // Операційні витрати по категоріях витрат.
  const expenseRows: Row[] = categoryBreakdown.map((e) => ({
    key: `exp-${e.name}`,
    label: e.name,
    amount: e.amount,
    color: "var(--color-rose)",
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-6 pt-4 sm:grid-cols-2">
        <MeterTile
          label="Сумарний Валовий Дохід"
          total={grossIncome}
          accentClass="text-emerald"
          left={`Продажі: ${money(totalSales)}`}
          right={`Ремонти: ${money(repairsRevenue)}`}
          fillPct={100}
          fillClass="bg-emerald"
          onClick={() => setOpen("income")}
        />

        <MeterTile
          label="Собівартість & Витрати"
          total={totalCost}
          accentClass="text-rose"
          left={`Собівартість: ${money(cogsTotal)}`}
          right={`Витрати: ${money(totalExpenses)}`}
          fillPct={Math.min(100, grossIncome > 0 ? Math.round((totalCost / grossIncome) * 100) : 100)}
          fillClass="bg-rose animate-progress"
          onClick={() => setOpen("cost")}
        />
      </div>

      {/* Модалка доходу */}
      <Modal
        isOpen={open === "income"}
        onClose={() => setOpen(null)}
        title="Валовий дохід"
        description="Надходження за період, розкладені по категоріях"
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-emerald/20 bg-emerald/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Разом надходжень</p>
            <p className="mt-0.5 text-2xl font-extrabold text-emerald">{money(grossIncome)}</p>
          </div>

          {incomeRows.length > 0 ? (
            <div className="space-y-4">
              {incomeRows.map((row) => (
                <BreakdownRow key={row.key} row={row} total={grossIncome} accent="var(--color-emerald)" />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted">За цей період надходжень немає.</p>
          )}
        </div>
      </Modal>

      {/* Модалка собівартості та витрат */}
      <Modal
        isOpen={open === "cost"}
        onClose={() => setOpen(null)}
        title="Собівартість & Витрати"
        description="Куди пішли гроші за період"
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-rose/20 bg-rose/5 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Разом витрат</p>
            <p className="mt-0.5 text-2xl font-extrabold text-rose">{money(totalCost)}</p>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-warm-border pb-1">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                Собівартість реалізації
              </h3>
              <span className="font-mono text-xs font-semibold text-text-primary">{money(cogsTotal)}</span>
            </div>
            {cogsRows.length > 0 ? (
              <div className="space-y-4">
                {cogsRows.map((row) => (
                  <BreakdownRow key={row.key} row={row} total={totalCost} accent="var(--color-rose)" />
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-sm text-text-muted">Собівартості за період немає.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-warm-border pb-1">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                Операційні витрати
              </h3>
              <span className="font-mono text-xs font-semibold text-text-primary">{money(totalExpenses)}</span>
            </div>
            {expenseRows.length > 0 ? (
              <div className="space-y-4">
                {expenseRows.map((row) => (
                  <BreakdownRow key={row.key} row={row} total={totalCost} accent="var(--color-rose)" />
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-sm text-text-muted">Операційних витрат за період немає.</p>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}
