export const dynamic = "force-dynamic";

import { getDevices, getDeviceRepairs } from "@/lib/data-devices";
import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters, getSafes } from "@/lib/data-finance";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { getParts } from "@/lib/data-parts";

import { DevicesClient } from "./DevicesClient";
import { AddDeviceButton } from "./AddDeviceButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import StandardCard from "@/components/ui/StandardCard";
import { pluralUk } from "@/lib/utils/plural";
import type { DeviceRow } from "./device-types";

export default async function DevicesPage() {
  const [devices, deviceRepairs, customers, cashRegisters, accessories, services, parts, safes] =
    await Promise.all([
      getDevices(),
      getDeviceRepairs(),
      getCustomers(),
      getCashRegisters(),
      getAccessories(),
      getServices(),
      getParts(),
      getSafes(),
    ]);

  // Every figure below is about stock on hand only. The labels say so —
  // previously they read as totals for the whole page while quietly counting
  // just `in_stock`, which made "Очікуваний прибуток" look like realised profit.
  const inStock = devices.filter((d) => d.status === "in_stock");
  const totalCost = inStock.reduce(
    (s, d) => s + d.cost_price + (d.needs_repair ? d.repair_cost : 0),
    0,
  );
  const totalValue = inStock.reduce((s, d) => s + d.price, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Техніка"
        subtitle={`${devices.length} ${pluralUk(devices.length, "пристрій", "пристрої", "пристроїв")} у системі · ${inStock.length} в наявності`}
        actions={<AddDeviceButton size="half" parts={parts} safes={safes} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="В наявності"
          value={`${inStock.length} шт`}
          tone="info"
          sub="готові до продажу"
          className="animate-entry-stagger delay-0"
        />
        <StatCard
          label="Вкладено у запас"
          value={`${totalCost.toLocaleString()} ₴`}
          tone="warning"
          sub="собівартість + ремонт"
          className="animate-entry-stagger delay-1"
        />
        <StatCard
          label="Запас за цінами продажу"
          value={`${totalValue.toLocaleString()} ₴`}
          sub="якщо продати все"
          className="animate-entry-stagger delay-2"
        />
        <StatCard
          label="Очікувана маржа"
          value={`${(totalValue - totalCost).toLocaleString()} ₴`}
          tone="accent"
          sub="ще не зароблено"
          className="animate-entry-stagger delay-3"
        />
      </div>

      <StandardCard>
        <DevicesClient
          devices={devices as unknown as DeviceRow[]}
          deviceRepairs={deviceRepairs}
          customers={customers}
          cashRegisters={cashRegisters}
          accessories={accessories}
          services={services}
          parts={parts}
          safes={safes}
        />
      </StandardCard>
    </div>
  );
}
