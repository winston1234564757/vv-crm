export const dynamic = "force-dynamic";

import { getSuppliers } from "@/lib/data-suppliers";
import { SuppliersTable } from "./table";
import { AddSupplierButton } from "./AddSupplierButton";
import { pluralUk } from "@/lib/utils/plural";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

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
        <SuppliersTable suppliers={suppliers} />
      </GlassCard>
    </div>
  );
}
