import { createClient } from "./supabase/server";
import { getSettings } from "./data-settings";
import { getAllSafesRaw } from "./request-cache";
import { loadDataset } from "./profit-dataset";
import { computeAverages, type AveragesTotals } from "./profit";

export type { AveragesTotals };

/** Менше доби від епохи — рахувати темп ще нема з чого, число тільки б брехало. */
const MIN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Середні показники магазину від фінансової епохи до зараз: гроші й одиниці
 * на день/тиждень, для дашборду і сторінки фінансів одразу — обидва мусять
 * показувати те саме число, тож рахує це рівно один викликач.
 *
 * `null`, коли епоха не задана чи некоректна (як `floorAtEpoch`), або коли
 * магазин молодший за добу — обидва випадки: рахувати нема з чого.
 */
export async function getAveragesSinceEpoch(): Promise<AveragesTotals | null> {
  const settings = await getSettings();
  const epochIso = settings.finance_epoch;
  if (!epochIso) return null;

  const epoch = new Date(epochIso);
  const now = new Date();
  if (Number.isNaN(epoch.getTime()) || now.getTime() - epoch.getTime() < MIN_WINDOW_MS) {
    return null;
  }

  const supabase = await createClient();
  const [loaded, safes] = await Promise.all([
    loadDataset(supabase, epoch, now),
    getAllSafesRaw(),
  ]);
  const netProfitSafeId = safes.find((s) => s.type === "net_profit")?.id ?? null;

  return computeAverages(loaded.dataset, epoch, now, settings.capital_category_id, netProfitSafeId);
}
