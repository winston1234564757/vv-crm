export const dynamic = "force-dynamic";

import { getDevices } from "@/lib/data-devices";
import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters, getSafes } from "@/lib/data-finance";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { getParts } from "@/lib/data-parts";
import { getInternalRepairs } from "@/lib/data-repairs";
import { DevicesTable } from "./table";
import { AddDeviceButton } from "./AddDeviceButton";
import { pluralUk } from "@/lib/utils/plural";
import GlassCard from "@/components/GlassCard";
import { supabaseCast } from "@/lib/utils/supabase";

export default async function DevicesPage() {
  const [devices, customers, cashRegisters, accessories, services, parts, repairs, safes] = await Promise.all([
    getDevices(),
    getCustomers(),
    getCashRegisters(),
    getAccessories(),
    getServices(),
    getParts(),
    getInternalRepairs(),
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Техніка</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {devices.length} {pluralUk(devices.length, "пристрій", "пристрої", "пристроїв")} у системі
          </p>
        </div>
        <AddDeviceButton size="half" parts={parts} safes={safes} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">В наявності</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{inStock} шт</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума запасів (виручка)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalValue.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Вкладено (собівартість + ремонт)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalCost.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Очікуваний чистий прибуток</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-violet font-medium">{expectedProfit.toLocaleString()} грн</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <DevicesTable 
            devices={devices as unknown as import('./table').DeviceRow[]} 
            customers={customers} 
            cashRegisters={cashRegisters} 
            accessories={accessories} 
            services={services}
            parts={parts} 
            repairs={repairs}
            safes={safes}
          />
        </GlassCard>
      </div>
    </div>
  );
}

