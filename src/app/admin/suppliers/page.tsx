export const dynamic = "force-dynamic";

import { getSuppliers } from "@/lib/data-suppliers";
import { getPurchases } from "@/lib/data-purchases";
import { SuppliersTable } from "./table";
import { AddSupplierButton } from "./AddSupplierButton";
import { pluralUk } from "@/lib/utils/plural";

import GlassCard from "@/components/GlassCard";

export default async function SuppliersPage() {
  const [suppliers, purchases] = await Promise.all([
    getSuppliers(),
    getPurchases()
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Постачальники</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{suppliers.length} {pluralUk(suppliers.length, "постачальник", "постачальники", "постачальників")}</p>
        </div>
        <AddSupplierButton />
      </div>
      <GlassCard>
        <SuppliersTable suppliers={suppliers} purchases={purchases} />
      </GlassCard>
    </div>
  );
}
