export const dynamic = "force-dynamic";

import { getClientOrders } from "@/lib/data-orders";
import { OrdersTable } from "./table";
import { AddOrderButton } from "../AddOrderButton";
import { pluralUk } from "@/lib/utils/plural";
import StandardCard from "@/components/ui/StandardCard";

const ACTIVE_STATUSES = ["new", "ordered", "arrived", "ready"];

export default async function OrdersPage() {
  const orders = await getClientOrders();

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const outstanding = active.reduce(
    (sum, o) => sum + Math.max(0, (o.agreed_price ?? 0) - (o.deposit ?? 0)),
    0,
  );
  const depositsHeld = active.reduce((sum, o) => sum + (o.deposit ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary text-balance">Замовлення</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {active.length} {pluralUk(active.length, "активне", "активні", "активних")} з {orders.length}
          </p>
        </div>
        <AddOrderButton variant="primary">Нове замовлення</AddOrderButton>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
        <StandardCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Активні замовлення</p>
          <p className="mt-2 text-4xl font-light tracking-tight text-text-primary">{active.length}</p>
        </StandardCard>
        <StandardCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Залишок до сплати</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{outstanding.toLocaleString()} грн</p>
        </StandardCard>
        <StandardCard interactive>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Авансів на руках</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">{depositsHeld.toLocaleString()} грн</p>
        </StandardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <StandardCard interactive>
          <OrdersTable orders={orders} />
        </StandardCard>
      </div>
    </div>
  );
}
