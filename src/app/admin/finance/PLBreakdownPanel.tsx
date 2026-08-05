"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Meter, type MeterTone } from "@/components/charts/Meter";
import { cn } from "@/lib/utils/cn";
import {
  CATEGORY_LABELS,
  PROFIT_CATEGORIES,
  type CategoryProfit,
  type ProfitCategory,
} from "@/lib/profit";

/**
 * Дві плитки P&L — Валовий дохід і Собівартість та витрати — клікабельні:
 * кожна відкриває модалку з розкладкою рівно тих чисел, що стоять на плитці.
 *
 * Джерело даних — той самий `report.byCategory` / `report.categoryBreakdown`,
 * що й лічильники (див. lib/profit). Тому підсумок модалки завжди дорівнює
 * числу на плитці: ніякого другого способу порахувати ті самі гроші.
 *
 * Категоріальної палітри тут немає навмисно. Раніше кожна з п'яти категорій
 * мала власний колір, хоч поруч стоїть її назва — колір не додавав сенсу,
 * якого не було вже написано словом, і суперечив DESIGN.md §7 («один акцент,
 * семантичні кольори для значення»). Смужки тепер акцентні, а семантичний
 * колір лишився там, де справді щось означає: дохід, витрата, знак маржі.
 */

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
  /** Ціла маржа у відсотках — лише для рядків доходу. */
  margin?: number;
}

function money(v: number): string {
  return `${v.toLocaleString()} ₴`;
}

/** Один рядок списку зі смужкою частки від підсумку. */
function BreakdownRow({ row, total }: { row: Row; total: number }) {
  const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-ink">
          <span className="font-medium">{row.label}</span>
          {row.margin != null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] tabular",
                row.margin >= 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
              )}
            >
              {row.margin >= 0 ? "+" : ""}
              {row.margin}%
            </span>
          )}
        </span>
        <span className="shrink-0 font-semibold tabular text-ink">{money(row.amount)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Meter value={pct} className="flex-1" />
        <span className="w-9 shrink-0 text-right text-[11px] tabular text-faint">{pct}%</span>
      </div>
    </div>
  );
}

/** Клікабельна плитка-лічильник. */
function MeterTile({
  label,
  total,
  accentClass,
  left,
  right,
  fillPct,
  fillTone,
  onClick,
}: {
  label: string;
  total: number;
  accentClass: string;
  left: string;
  right: string;
  fillPct: number;
  fillTone: MeterTone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group -mx-2 cursor-pointer space-y-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted">
          {label}
          <span className="text-faint opacity-0 transition-opacity group-hover:opacity-100">→</span>
        </span>
        <span className={cn("font-semibold tabular", accentClass)}>{money(total)}</span>
      </div>
      <Meter value={fillPct} tone={fillTone} />
      <div className="flex justify-between text-[11px] text-faint">
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
  const incomeRows: Row[] = PROFIT_CATEGORIES.map((cat: ProfitCategory): Row | null => {
    const c = byCat.get(cat);
    if (!c || c.revenue <= 0) return null;
    return { key: cat, label: CATEGORY_LABELS[cat], amount: c.revenue, margin: c.margin };
  }).filter((r): r is Row => r !== null);

  // Собівартість реалізації по категоріях — теж лише ненульові.
  const cogsRows: Row[] = PROFIT_CATEGORIES.map((cat: ProfitCategory): Row | null => {
    const c = byCat.get(cat);
    if (!c || c.cost <= 0) return null;
    return { key: cat, label: CATEGORY_LABELS[cat], amount: c.cost };
  }).filter((r): r is Row => r !== null);

  // Операційні витрати по категоріях витрат.
  const expenseRows: Row[] = categoryBreakdown.map((e) => ({
    key: `exp-${e.name}`,
    label: e.name,
    amount: e.amount,
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-6 pt-4 sm:grid-cols-2">
        <MeterTile
          label="Сумарний валовий дохід"
          total={grossIncome}
          accentClass="text-success"
          left={`Продажі: ${money(totalSales)}`}
          right={`Ремонти: ${money(repairsRevenue)}`}
          fillPct={100}
          fillTone="success"
          onClick={() => setOpen("income")}
        />

        <MeterTile
          label="Собівартість і витрати"
          total={totalCost}
          accentClass="text-danger"
          left={`Собівартість: ${money(cogsTotal)}`}
          right={`Витрати: ${money(totalExpenses)}`}
          fillPct={Math.min(100, grossIncome > 0 ? Math.round((totalCost / grossIncome) * 100) : 100)}
          fillTone="danger"
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
          <div className="rounded-[var(--radius-lg)] bg-success-subtle px-4 py-3">
            <p className="text-xs font-medium text-muted">Разом надходжень</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tabular text-success">
              {money(grossIncome)}
            </p>
          </div>

          {incomeRows.length > 0 ? (
            <div className="space-y-4">
              {incomeRows.map((row) => (
                <BreakdownRow key={row.key} row={row} total={grossIncome} />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">За цей період надходжень немає.</p>
          )}
        </div>
      </Modal>

      {/* Модалка собівартості та витрат */}
      <Modal
        isOpen={open === "cost"}
        onClose={() => setOpen(null)}
        title="Собівартість і витрати"
        description="Куди пішли гроші за період"
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] bg-danger-subtle px-4 py-3">
            <p className="text-xs font-medium text-muted">Разом витрат</p>
            <p className="mt-0.5 font-display text-2xl font-semibold tabular text-danger">
              {money(totalCost)}
            </p>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold text-ink">Собівартість реалізації</h3>
              <span className="text-xs font-semibold tabular text-ink">{money(cogsTotal)}</span>
            </div>
            {cogsRows.length > 0 ? (
              <div className="space-y-4">
                {cogsRows.map((row) => (
                  <BreakdownRow key={row.key} row={row} total={totalCost} />
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-sm text-muted">Собівартості за період немає.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h3 className="text-sm font-semibold text-ink">Операційні витрати</h3>
              <span className="text-xs font-semibold tabular text-ink">{money(totalExpenses)}</span>
            </div>
            {expenseRows.length > 0 ? (
              <div className="space-y-4">
                {expenseRows.map((row) => (
                  <BreakdownRow key={row.key} row={row} total={totalCost} />
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-sm text-muted">
                Операційних витрат за період немає.
              </p>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}
