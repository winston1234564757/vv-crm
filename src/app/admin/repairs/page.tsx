export const dynamic = "force-dynamic";

import { getAllRepairs, getRepairPaidTotals } from "@/lib/data-repairs";
import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters } from "@/lib/data-finance";

import { RepairsClient } from "./RepairsClient";
import { AddRepairButton } from "./AddRepairButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import StandardCard from "@/components/ui/StandardCard";
import { pluralUk } from "@/lib/utils/plural";
import { repairGroup, isUnpaid, outstanding } from "@/lib/repair-flow";
import { isOverdue, type RepairRow } from "./repair-types";

export default async function RepairsPage() {
  // Devices are no longer loaded here: warehouse repairs are started from the
  // device itself on Техніка, not from this page's intake form.
  const [allRepairs, paidTotals, customers, cashRegisters] = await Promise.all([
    getAllRepairs(),
    getRepairPaidTotals(),
    getCustomers(),
    getCashRegisters(),
  ]);

  const repairs = allRepairs as unknown as RepairRow[];

  const active = repairs.filter((r) => repairGroup(r.status) === "active").length;
  const ready = repairs.filter((r) => repairGroup(r.status) === "ready").length;
  const overdue = repairs.filter(isOverdue).length;

  // Debt is read off the ledger, not off the label — that distinction is the
  // whole point of this slice.
  const debt = repairs.reduce(
    (sum, r) => sum + (isUnpaid(r) ? outstanding(r, paidTotals[r.id] ?? 0) : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ремонти"
        subtitle={`${repairs.length} ${pluralUk(repairs.length, "заявка", "заявки", "заявок")} · ${active} в роботі`}
        actions={<AddRepairButton customers={customers} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="В роботі"
          value={active}
          tone="accent"
          sub="прийнято, діагностика, ремонт"
          className="animate-entry-stagger delay-0"
        />
        <StatCard
          label="Готові до видачі"
          value={ready}
          tone="success"
          sub="можна забирати"
          className="animate-entry-stagger delay-1"
        />
        <StatCard
          label="Прострочено"
          value={overdue}
          tone={overdue > 0 ? "danger" : "default"}
          sub="дедлайн минув"
          className="animate-entry-stagger delay-2"
        />
        <StatCard
          label="Не отримано"
          value={`${debt.toLocaleString()} ₴`}
          tone={debt > 0 ? "warning" : "default"}
          sub="борг за виконані роботи"
          className="animate-entry-stagger delay-3"
        />
      </div>

      <StandardCard>
        <RepairsClient
          repairs={repairs}
          paidTotals={paidTotals}
          customers={customers}
          cashRegisters={cashRegisters}
        />
      </StandardCard>
    </div>
  );
}
