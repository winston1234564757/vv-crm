import StandardCard from "@/components/ui/StandardCard";
export const dynamic = "force-dynamic";

import { requirePageRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { getPurchases } from "@/lib/data-purchases";
import { PurchasesTable } from "./table";
import { AddPurchaseButton } from "./AddPurchaseButton";
import { pluralUk } from "@/lib/utils/plural";
import { getSafes, getCashRegisters } from "@/lib/data-finance";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function PurchasesPage() {
  // Той самий список, що й у `deletePurchase` — сторінка показує собівартість
  // і рухи по сейфах, тобто рівно те, що ховається на дашборді.
  await requirePageRole(MONEY_ROLES);

  const [purchases, safes, registers] = await Promise.all([
    getPurchases(),
    getSafes(),
    getCashRegisters(),
  ]);
  const total = purchases.reduce((s, p) => s + p.total_amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary text-balance">Закупівлі</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{purchases.length} {pluralUk(purchases.length, "закупівля", "закупівлі", "закупівель")}</p>
        </div>
        <AddPurchaseButton safes={safes} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
        <StandardCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього витрачено</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{total.toLocaleString()} грн</p>
        </StandardCard>
        <StandardCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Очікується</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-amber">{purchases.filter(p => p.status === "pending").length}</p>
        </StandardCard>
        <StandardCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Отримано</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{purchases.filter(p => p.status === "received").length}</p>
        </StandardCard>
      </div>
      <StandardCard>
        <PurchasesTable purchases={purchases} safes={safes} registers={registers} />
      </StandardCard>
    </div>
  );
}
