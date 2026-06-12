export const dynamic = "force-dynamic";

import { getServices } from "@/lib/data-services";
import { ServicesTable } from "./table";
import { AddServiceButton } from "./AddServiceButton";
import { pluralUk } from "@/lib/utils/plural";

import GlassCard from "@/components/GlassCard";

export default async function ServicesPage() {
  const services = await getServices();

  const activeServices = services.filter(s => s.status === "active");
  const totalRevenue = services.reduce((s, sv) => s + sv.price, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Послуги</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {services.length} {pluralUk(services.length, "послуга", "послуги", "послуг")} у системі
          </p>
        </div>
        <AddServiceButton />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Активні послуги</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{activeServices.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">На вітрині</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{services.filter(s => s.is_visible).length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума цін (усі послуги)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalRevenue.toLocaleString()} грн</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <ServicesTable services={services} />
        </GlassCard>
      </div>
    </div>
  );
}
