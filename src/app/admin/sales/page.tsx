import StandardCard from "@/components/ui/StandardCard";
import { getSales } from "@/lib/data-sales";
import { SalesTable } from "./table";
import { SalesAnalytics } from "./SalesAnalytics";
import { pluralUk } from "@/lib/utils/plural";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const sales = await getSales();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink text-balance">Продажі</h1>
        <p className="mt-0.5 text-sm text-muted">
          {sales.length} {pluralUk(sales.length, "продаж", "продажі", "продажів")} у системі
        </p>
      </header>

      <SalesAnalytics sales={sales} />

      <StandardCard>
        <SalesTable sales={sales} />
      </StandardCard>
    </div>
  );
}
