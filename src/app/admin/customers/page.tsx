export const dynamic = "force-dynamic";

import { getCustomers, getSalesForHistory } from "@/lib/data-customers";
import { getRepairs } from "@/lib/data-repairs";
import { IconPlus } from "@/components/icons";
import { CustomersTable } from "./table";
import { AddCustomerButton } from "./AddCustomerButton";
import { pluralUk } from "@/lib/utils/plural";

import GlassCard from "@/components/GlassCard";

export default async function CustomersPage() {
  const [customers, sales, repairs] = await Promise.all([
    getCustomers(),
    getSalesForHistory(),
    getRepairs()
  ]);

  const totalSpent = customers.reduce((s, c) => s + c.total_spent, 0);
  const todayCount = customers.filter((c) => {
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
            {customers.length} {pluralUk(customers.length, "клієнт", "клієнти", "клієнтів")} у системі
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
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{customers.length > 0 ? Math.round(totalSpent / customers.length).toLocaleString() : 0} грн</p>
        </GlassCard>
        <GlassCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сьогодні</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{todayCount}</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard interactive>
          <CustomersTable customers={customers} sales={sales} repairs={repairs} />
        </GlassCard>
      </div>
    </div>
  );
}
