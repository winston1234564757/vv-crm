import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

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
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
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

  const prompt = `Ти — AI-аналітик для невеликого магазину електроніки та майстерні в Україні. 
Тебе звати VV Intelligence. Твоя мета — допомагати власнику приймати рішення, які збільшать прибуток.

Поточні дані бізнесу за сьогодні та останні 30-90 днів:

ПРОДАЖІ:
- Сьогоднішній виторг: ${payload.todaySalesTotal.toLocaleString()} ₴ (план: ${payload.salesTarget.toLocaleString()} ₴, ${payload.salesProgress}%)
- Повторні клієнти за 90 днів: ${payload.customerReturnRate}%
- Крос-продажі: конверсія ${payload.crossSellConversionRate}%, дохід ${payload.crossSellRevenue30Days.toLocaleString()} ₴/30д

РЕМОНТИ:
- Активних ремонтів: ${payload.activeRepairs}
- Чекають деталі: ${payload.awaitingParts}
- Затримка логістики: ${payload.supplyChainDelayRate}% ремонтів заблоковано

ФІНАНСИ:
- OPEX резерв: ${payload.opexRunwayDays} днів (витрати ${payload.dailyOpexRunRate.toLocaleString()} ₴/день)
- B2B партнери: ${payload.partnerVolumeShare}% обороту

ТОП МОДЕЛЕЙ (попит):
${topModelsText}

КРИТИЧНІ ЗАЛИШКИ (закінчуються):
${stockoutText}

ПІКОВІ ГОДИНИ ПРОДАЖІВ:
- Найприбутковіший день: ${peakDayName}
- Найприбутковіша година: ${payload.peakRevenueHour}:00
- Середній чек у пік: ${payload.peakAvgCheck.toLocaleString()} ₴

Згенеруй 4-5 конкретних, actionable бізнес-інсайтів для власника. 
Формат відповіді — тільки валідний JSON масив об'єктів, без жодного Markdown та пояснень. 
Кожен об'єкт МУСИТЬ мати поля:
- "type": одне з "opportunity" | "warning" | "achievement" | "info"  
- "title": короткий заголовок (до 7 слів), починається з емодзі
- "description": 2-3 речення. Конкретні цифри. Конкретна дія.
- "action": кнопка-підказка (до 5 слів)
- "impact": "high" | "medium" | "low"

Приклад одного об'єкта:
{"type":"opportunity","title":"💰 Піковий день — четвер","description":"Найбільші чеки фіксуються в четвер о 15:00. Середній чек 2,300 ₴ — вдвічі більший за решту днів. Плануйте поставки та акції саме на четвер.","action":"Запланувати поставку","impact":"high"}

Відповідай ТІЛЬКИ JSON масивом.`;

  try {
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("[ai-insights] Gemini API error:", errText);
      return NextResponse.json(
        { error: "Gemini API request failed", insights: buildFallbackInsights(payload) },
        { status: 200 }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    let insights: SmartInsight[] = [];
    try {
      const parsed = JSON.parse(rawText);
      insights = Array.isArray(parsed) ? parsed : buildFallbackInsights(payload);
    } catch {
      insights = buildFallbackInsights(payload);
    }

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[ai-insights] fetch error:", err);
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
