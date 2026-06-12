export const dynamic = "force-dynamic";

import { getAccessories } from "@/lib/data-accessories";
import { IconPlus } from "@/components/icons";
import { AccessoriesTable } from "./table";
import { AddAccessoryButton } from "./AddAccessoryButton";
import { ImportAccessoriesButton } from "./ImportAccessoriesButton";
import { pluralUk } from "@/lib/utils/plural";

import GlassCard from "@/components/GlassCard";

export default async function AccessoriesPage() {
  const accessories = await getAccessories();

  const totalItems = accessories.reduce((s, a) => s + a.stock, 0);
  const totalValue = accessories.reduce((s, a) => s + a.stock * a.price, 0);
  const totalCost = accessories.reduce((s, a) => s + a.stock * a.cost_price, 0);
  const expectedProfit = totalValue - totalCost;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Аксесуари</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {accessories.length} {pluralUk(accessories.length, "позиція", "позиції", "позицій")} у системі
          </p>
        </div>
        <div className="flex gap-2">
          <ImportAccessoriesButton />
          <AddAccessoryButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього одиниць</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalItems} шт</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума запасів (виручка)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalValue.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Вкладено (собівартість)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalCost.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Очікуваний чистий прибуток</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-violet font-medium">{expectedProfit.toLocaleString()} грн</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-5">
        <GlassCard>
          <AccessoriesTable accessories={accessories} />
        </GlassCard>
      </div>
    </div>
  );
}
