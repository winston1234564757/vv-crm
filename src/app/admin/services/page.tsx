export const dynamic = "force-dynamic";

import { getServices } from "@/lib/data-services";
import { getSales } from "@/lib/data-sales";
import { ServicesTable } from "./table";
import { AddServiceButton } from "./AddServiceButton";
import { pluralUk } from "@/lib/utils/plural";

import StandardCard from "@/components/ui/StandardCard";

export default async function ServicesPage() {
  const [services, sales] = await Promise.all([
    getServices(),
    getSales()
  ]);

  const activeServices = services.filter(s => s.status === "active");
  const totalRevenue = services.reduce((s, sv) => s + sv.price, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary text-balance">Послуги</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {services.length} {pluralUk(services.length, "послуга", "послуги", "послуг")} у системі
          </p>
        </div>
        <AddServiceButton />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
        <StandardCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Активні послуги</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{activeServices.length}</p>
        </StandardCard>
        <StandardCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">На вітрині</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{services.filter(s => s.is_visible).length}</p>
        </StandardCard>
        <StandardCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума цін (усі послуги)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalRevenue.toLocaleString()} грн</p>
        </StandardCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <StandardCard>
          <ServicesTable services={services} sales={sales} />
        </StandardCard>
      </div>
    </div>
  );
}
