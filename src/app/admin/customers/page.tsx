export const dynamic = "force-dynamic";

import { getCustomers } from "@/lib/data-customers";
import { getSales } from "@/lib/data-sales";
import { getRepairs } from "@/lib/data-repairs";
import { IconPlus } from "@/components/icons";
import { CustomersTable } from "./table";
import { AddCustomerButton } from "./AddCustomerButton";
import { pluralUk } from "@/lib/utils/plural";

import GlassCard from "@/components/GlassCard";

export default async function CustomersPage() {
  const [customers, sales, repairs] = await Promise.all([
    getCustomers(),
    getSales(),
    getRepairs()
  ]);

  const resolvedCustomers = (customers ?? []).map((c) => {
    const clientSales = sales.filter((s) => s.customer_id === c.id);
    const salesSpent = clientSales.reduce((sum, s) => sum + s.total_amount, 0);
    const salesCount = clientSales.length;

    const clientRepairs = repairs.filter(
      (r) => r.customer_id === c.id && ["completed", "handed_over"].includes(r.status)
    );
    const repairsSpent = clientRepairs.reduce((sum, r) => sum + r.price, 0);
    const repairsCount = clientRepairs.length;

    return {
      ...c,
      total_spent: salesSpent + repairsSpent,
      total_visits: salesCount + repairsCount,
    };
  });

  const totalSpent = resolvedCustomers.reduce((s, c) => s + c.total_spent, 0);
  const todayCount = resolvedCustomers.filter((c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Клієнти</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {resolvedCustomers.length} {pluralUk(resolvedCustomers.length, "клієнт", "клієнти", "клієнтів")} у системі
          </p>
        </div>
        <AddCustomerButton />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <GlassCard interactive>
            <p className="text-xs font-medium tracking-wider text-text-secondary">Всього витрачено</p>
            <p className="mt-2 text-4xl font-light tracking-tight text-text-primary">{totalSpent.toLocaleString()} грн</p>
          </GlassCard>
        </div>
        <GlassCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Середній чек</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{resolvedCustomers.length > 0 ? Math.round(totalSpent / resolvedCustomers.length).toLocaleString() : 0} грн</p>
        </GlassCard>
        <GlassCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сьогодні</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{todayCount}</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard interactive>
          <CustomersTable customers={resolvedCustomers} sales={sales} repairs={repairs} />
        </GlassCard>
      </div>
    </div>
  );
}
