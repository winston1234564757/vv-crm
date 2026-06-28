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
import StandardCard from "@/components/ui/StandardCard";
import { supabaseCast } from "@/lib/utils/supabase";
import { IconDevice, IconBox, IconFinance } from "@/components/icons";

function StatCard({
  label,
  value,
  accent,
  sub,
  icon,
  delay = 0,
}: {
  label: string;
  value: string | number;
  accent: "violet" | "cyan" | "rose" | "amber" | "iris";
  sub?: string;
  icon: React.ReactNode;
  delay?: number;
}) {
  const accentColors = {
    violet: { bg: "bg-violet/[0.06] border-violet/10", text: "text-violet" },
    cyan:   { bg: "bg-cyan/[0.06] border-cyan/10",   text: "text-cyan" },
    rose:   { bg: "bg-rose/[0.06] border-rose/10",   text: "text-rose" },
    amber:  { bg: "bg-amber/[0.06] border-amber/10",  text: "text-amber" },
    iris:   { bg: "bg-iris/[0.06] border-iris/10",   text: "text-iris" },
  };
  const c = accentColors[accent];

  return (
    <div 
      className={`rounded-[2rem] border border-slate-100 bg-slate-50/40 p-1.5 shadow-sm shadow-slate-100/30 flex flex-col transition-all duration-500 hover:shadow-md hover:border-slate-200/80 animate-entry-stagger delay-${delay}`}
    >
      <div 
        className="rounded-[calc(2rem-0.375rem)] bg-white p-5 flex flex-col justify-between h-full shadow-[inset_0_1px_1px_rgba(255,255,255,1)] relative overflow-hidden"
      >
        {/* Subtle background glow orb */}
        <div className={`absolute -right-4 -bottom-4 w-12 h-12 rounded-full blur-2xl opacity-20 ${c.bg}`} />
        
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-1 block">Склад</span>
            <p className="text-xs font-semibold text-slate-600 leading-tight">{label}</p>
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${c.bg} ${c.text} shrink-0 border shadow-sm`}>
            {icon}
          </span>
        </div>
        
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[10px] text-slate-400 font-medium flex items-center gap-1 font-mono">
              <span>●</span>
              <span>{sub}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
          accent="cyan"
          sub="усі пристрої"
          icon={<IconDevice size={16} />}
          delay={0}
        />
        <StatCard
          label="Сума запасів (виручка)"
          value={`${totalValue.toLocaleString()} ₴`}
          accent="iris"
          sub="ціна продажу"
          icon={<IconFinance size={16} />}
          delay={1}
        />
        <StatCard
          label="Вкладено"
          value={`${totalCost.toLocaleString()} ₴`}
          accent="amber"
          sub="собів. + ремонт"
          icon={<IconBox size={16} />}
          delay={2}
        />
        <StatCard
          label="Очікуваний прибуток"
          value={`${expectedProfit.toLocaleString()} ₴`}
          accent="violet"
          sub="очікувана маржа"
          icon={<IconFinance size={16} />}
          delay={3}
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
            repairs={repairs}
            safes={safes}
          />
        </StandardCard>
      </div>
    </div>
  );
}

