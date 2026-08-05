import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import { loadDataset } from "./profit-dataset";
import { floorAtEpoch, resolveRange, sliceProfit, topSellers } from "./profit";
import type { RangePreset, SkuLine, SkuSort } from "./profit";
import { supabaseCast } from "./utils/supabase";

/**
 * Що саме продається — у штуках, а не лише в гривнях.
 *
 * Дірка, яку власники назвали другою за важливістю: `quantity` у базі жила
 * тільки як множник собівартості, тож на питання «який товар найкраще йде»
 * відповіді не було взагалі. Виторг показував, що дорогий апарат дав більше
 * грошей, ніж сто скл — але не показував, що скла продались сто разів, а
 * апарат один.
 *
 * Рахує `topSellers` із `profit.ts` — тими самими `allocateSaleRevenue` та
 * `itemCost`, що й прибуток. Сума `revenue` по рядках дорівнює виторгу з
 * рушія за побудовою, тож ця таблиця не може розійтись із рештою екранів.
 */
export interface SkuReport {
  lines: SkuLine[];
  /** Контрольна сума: має дорівнювати виторгу рушія за той самий період. */
  revenueTotal: number;
  unitsTotal: number;
  /** Порожній період (усе вікно до епохи) — не те саме, що «нічого не продано». */
  empty: boolean;
}

/** Назви позицій з чотирьох каталогів: `item_id` поліморфний і FK не має. */
async function loadNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, string>> {
  const [devRes, accRes, partRes, svcRes] = await Promise.all([
    supabase.from("devices").select("id, brand, model"),
    supabase.from("accessories").select("id, name"),
    supabase.from("parts").select("id, name"),
    supabase.from("services").select("id, name"),
  ]);

  const names = new Map<string, string>();

  for (const d of supabaseCast<{ id: string; brand: string | null; model: string | null }[]>(
    devRes.data ?? [],
  )) {
    names.set(d.id, [d.brand, d.model].filter(Boolean).join(" ").trim() || "Без назви");
  }
  for (const rows of [accRes.data, partRes.data, svcRes.data]) {
    for (const r of supabaseCast<{ id: string; name: string }[]>(rows ?? [])) {
      names.set(r.id, r.name);
    }
  }

  return names;
}

export async function getSkuReport(
  preset: RangePreset = "30d",
  sort: SkuSort = "units",
): Promise<SkuReport> {
  const supabase = await createClient();
  const { finance_epoch } = await getSettings();

  const raw = resolveRange(preset, new Date());
  const { start, end, empty } = floorAtEpoch(raw.start, raw.end, finance_epoch);

  if (empty) {
    return { lines: [], revenueTotal: 0, unitsTotal: 0, empty: true };
  }

  const [loaded, names] = await Promise.all([
    loadDataset(supabase, start, end),
    loadNames(supabase),
  ]);

  const lines = topSellers(loaded.dataset.sales, loaded.dataset.devices, names, sort);

  /* Контрольна сума береться з рушія, а не з суми рядків: якби вона рахувалась
     із тих самих рядків, вона підтверджувала б сама себе й нічого не ловила.
     Ремонти віднімаємо — `topSellers` їх не включає навмисно. */
  const profit = sliceProfit(loaded.dataset, start, end);
  const repairs = profit.byCategory.find((c) => c.category === "repair")?.revenue ?? 0;

  return {
    lines,
    revenueTotal: profit.revenue - repairs,
    unitsTotal: lines.reduce((s, l) => s + l.units, 0),
    empty: false,
  };
}
