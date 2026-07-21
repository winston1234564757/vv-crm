export const dynamic = "force-dynamic";

import { getDevices } from "@/lib/data-devices";
import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters, getSafes } from "@/lib/data-finance";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { getParts } from "@/lib/data-parts";

import { DevicesTable } from "./table";
import { AddDeviceButton } from "./AddDeviceButton";
import { pluralUk } from "@/lib/utils/plural";
import StandardCard from "@/components/ui/StandardCard";
import { supabaseCast } from "@/lib/utils/supabase";
import { IconDevice, IconBox, IconFinance } from "@/components/icons";
import { StatCard } from "@/components/ui/StatCard";

export default async function DevicesPage() {
  const [devices, customers, cashRegisters, accessories, services, parts, safes] = await Promise.all([
    getDevices(),
    getCustomers(),
    getCashRegisters(),
    getAccessories(),
    getServices(),
    getParts(),
    getSafes(),
  ]);

  const inStockDevices = devices.filter((d) => d.status === "in_stock");
  const inStock = inStockDevices.length;
  
  // Собівартість: ціна закупівлі + вартість ремонту (якщо потребує ремонту)
  const totalCost = inStockDevices.reduce(
    (s, d) => s + d.cost_price + (d.needs_repair ? d.repair_cost : 0), 
    0
  );
  const totalValue = inStockDevices.reduce((s, d) => s + d.price, 0);
  const expectedProfit = totalValue - totalCost;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
              <IconDevice size={18} />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary text-balance">Техніка</h1>
          </div>
          <p className="text-sm text-text-secondary pl-[46px]">
            {devices.length} {pluralUk(devices.length, "пристрій", "пристрої", "пристроїв")} у системі
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddDeviceButton size="half" parts={parts} safes={safes} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="В наявності"
          value={`${inStock} шт`}
          tone="info"
          sub="усі пристрої"
          icon={<IconDevice size={16} />}
          className="animate-entry-stagger delay-0"
        />
        <StatCard
          label="Сума запасів (виручка)"
          value={`${totalValue.toLocaleString()} ₴`}
          tone="default"
          sub="ціна продажу"
          icon={<IconFinance size={16} />}
          className="animate-entry-stagger delay-1"
        />
        <StatCard
          label="Вкладено"
          value={`${totalCost.toLocaleString()} ₴`}
          tone="warning"
          sub="собів. + ремонт"
          icon={<IconBox size={16} />}
          className="animate-entry-stagger delay-2"
        />
        <StatCard
          label="Очікуваний прибуток"
          value={`${expectedProfit.toLocaleString()} ₴`}
          tone="accent"
          sub="очікувана маржа"
          icon={<IconFinance size={16} />}
          className="animate-entry-stagger delay-3"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <StandardCard>
          <DevicesTable 
            devices={devices as unknown as import('./table').DeviceRow[]} 
            customers={customers} 
            cashRegisters={cashRegisters} 
            accessories={accessories} 
            services={services}
            parts={parts} 
            safes={safes}
          />
        </StandardCard>
      </div>
    </div>
  );
}

