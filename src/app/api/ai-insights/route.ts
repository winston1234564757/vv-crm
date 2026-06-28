import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchGemini, GeminiRateLimitError, safeParseJSON } from "@/lib/utils/gemini";
import { buildInsightsPrompt } from "@/lib/ai-prompts";

export interface SmartInsight {
  type: "opportunity" | "warning" | "achievement" | "info";
  title: string;
  description: string;
  action?: string;
  impact: "high" | "medium" | "low";
}

export interface AIInsightsPayload {
  todaySalesTotal: number;
  salesTarget: number;
  salesProgress: number;
  activeRepairs: number;
  awaitingParts: number;
  crossSellConversionRate: number;
  crossSellRevenue30Days: number;
  supplyChainDelayRate: number;
  customerReturnRate: number;
  partnerVolumeShare: number;
  opexRunwayDays: number;
  dailyOpexRunRate: number;
  topModels: Array<{
    brand: string;
    model: string;
    repair_count: number;
    sold_count: number;
    avg_margin: number;
    demand_score: number;
  }>;
  criticalStockout: Array<{
    item_name: string;
    item_type: string;
    days_until_stockout: number;
    avg_daily_demand: number;
  }>;
  peakRevenueDow: number;   // day of week with highest avg_check
  peakRevenueHour: number;  // hour with highest avg_check
  peakAvgCheck: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: AIInsightsPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const DOW_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  const topModelsText =
    payload.topModels.length > 0
      ? payload.topModels
          .slice(0, 5)
          .map(
            (m) =>
              `${m.brand} ${m.model} (ремонти: ${m.repair_count}, продажі: ${m.sold_count}, маржа: ${m.avg_margin} ₴, demand score: ${m.demand_score})`
          )
          .join("\n")
      : "Даних про моделі немає";

  const stockoutText =
    payload.criticalStockout.length > 0
      ? payload.criticalStockout
          .slice(0, 5)
          .map(
            (s) =>
              `${s.item_name} (${s.item_type === "part" ? "запчастина" : "аксесуар"}) — залишилось ~${s.days_until_stockout} днів, попит ${s.avg_daily_demand.toFixed(1)} шт/день`
          )
          .join("\n")
      : "Критичних залишків немає";

  const peakDayName = DOW_NAMES[payload.peakRevenueDow] ?? "?";

  const prompt = buildInsightsPrompt({
    todaySalesTotal: payload.todaySalesTotal,
    salesTarget: payload.salesTarget,
    salesProgress: payload.salesProgress,
    activeRepairs: payload.activeRepairs,
    awaitingParts: payload.awaitingParts,
    crossSellConversionRate: payload.crossSellConversionRate,
    crossSellRevenue30Days: payload.crossSellRevenue30Days,
    supplyChainDelayRate: payload.supplyChainDelayRate,
    customerReturnRate: payload.customerReturnRate,
    partnerVolumeShare: payload.partnerVolumeShare,
    opexRunwayDays: payload.opexRunwayDays,
    dailyOpexRunRate: payload.dailyOpexRunRate,
    topModelsText,
    stockoutText,
    peakDayName,
    peakRevenueHour: payload.peakRevenueHour,
    peakAvgCheck: payload.peakAvgCheck,
  });

  try {
    const config = {
      responseMimeType: "application/json" as const,
    };
    const geminiData = await fetchGemini([{ role: "user", parts: [{ text: prompt }] }], config);
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    const parsed = safeParseJSON<SmartInsight[] | unknown>(rawText, null);
    const insights: SmartInsight[] = Array.isArray(parsed) ? parsed as SmartInsight[] : buildFallbackInsights(payload);

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[ai-insights] fetch error:", err);
    // При rate limit або будь-якій іншій помилці — повертаємо rule-based fallback (без 500)
    if (err instanceof GeminiRateLimitError) {
      return NextResponse.json({ insights: buildFallbackInsights(payload), rateLimited: true });
    }
    return NextResponse.json({
      insights: buildFallbackInsights(payload),
    });
  }
}

/** Rule-based fallback if Gemini is unavailable */
function buildFallbackInsights(p: AIInsightsPayload): SmartInsight[] {
  const insights: SmartInsight[] = [];
  const DOW_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  if (p.crossSellConversionRate < 25) {
    insights.push({
      type: "opportunity",
      title: "💰 Потенціал допродажів не розкрито",
      description: `Лише ${p.crossSellConversionRate}% угод включають аксесуари. Галузевий орієнтир — 35%. Кожен 10-й незаписаний крос-сейл = упущений прибуток.`,
      action: "Перевірити POS-рекомендації",
      impact: "high",
    });
  }

  if (p.supplyChainDelayRate > 25) {
    insights.push({
      type: "warning",
      title: "⚠️ Ланцюг постачання блокує роботу",
      description: `${p.supplyChainDelayRate}% ремонтів стоять через відсутність запчастин. Кожен заблокований ремонт = незадоволений клієнт та замороженні кошти.`,
      action: "Замовити термінові деталі",
      impact: "high",
    });
  }

  if (p.criticalStockout.length > 0) {
    const first = p.criticalStockout[0];
    insights.push({
      type: "warning",
      title: `📦 ${first.item_name} закінчується`,
      description: `Залишилось приблизно ${first.days_until_stockout} днів при поточному попиті ${first.avg_daily_demand.toFixed(1)} шт/день. Замовте поповнення заздалегідь.`,
      action: "Перейти до постачальника",
      impact: "high",
    });
  }

  if (p.peakAvgCheck > 0) {
    insights.push({
      type: "info",
      title: `🕐 Пікові продажі — ${DOW_NAMES[p.peakRevenueDow]} ${p.peakRevenueHour}:00`,
      description: `Середній чек у пік — ${p.peakAvgCheck.toLocaleString()} ₴. Плануйте найдосвідченіших продавців на цей час, щоб максимізувати конверсію.`,
      action: "Переглянути розклад",
      impact: "medium",
    });
  }

  if (p.customerReturnRate > 35) {
    insights.push({
      type: "achievement",
      title: "🏆 Лояльність вище галузевої норми",
      description: `${p.customerReturnRate}% клієнтів повернулись за 90 днів. Це сильний показник довіри. Запустіть реферальну програму для підсилення ефекту.`,
      action: "Налаштувати реферали",
      impact: "medium",
    });
  }

  return insights;
}
