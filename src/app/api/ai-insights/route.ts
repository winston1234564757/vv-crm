import { NextRequest, NextResponse } from "next/server";
import { checkRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { fetchGemini, GeminiRateLimitError, safeParseJSON } from "@/lib/utils/gemini";
import { buildInsightsPrompt } from "@/lib/ai-prompts";
import { getDashboardMoney } from "@/lib/data-dashboard";
import { getOperationsData } from "@/lib/data-operations";
import { findAttention } from "@/lib/attention";
import { getSettings } from "@/lib/data-settings";
import { RANGE_LABELS, CATEGORY_LABELS, isRangePreset, type RangePreset } from "@/lib/profit";

export interface SmartInsight {
  type: "opportunity" | "warning" | "achievement" | "info";
  title: string;
  description: string;
  action?: string;
  impact: "high" | "medium" | "low";
}

export async function POST(request: NextRequest) {
  // Інсайти будуються з прибутку, витрат і OPEX-резерву — це той самий рівень
  // доступу, що й фінансовий розділ, тож і список ролей той самий.
  const access = await checkRole(MONEY_ROLES);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { user } = access;

  let body: { range?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const preset: RangePreset = isRangePreset(body.range) ? body.range : "today";

  const [money, operations, settings] = await Promise.all([
    getDashboardMoney(preset, user.id),
    getOperationsData(),
    getSettings(),
  ]);

  const groups = findAttention(operations.attention, new Date());

  const prompt = buildInsightsPrompt({
    rangeLabel: RANGE_LABELS[preset],
    revenue: money.profit.revenue,
    profit: money.profit.profit,
    marginPercent: money.profit.margin,
    byCategoryText: money.profit.byCategory
      .filter((c) => c.revenue > 0)
      .map((c) => `${CATEGORY_LABELS[c.category]} ${c.revenue} ₴ / ${c.profit} ₴ / ${c.margin}%`)
      .join("; "),
    dailyTarget: settings.sales_targets.daily,
    monthlyTarget: settings.sales_targets.monthly,
    monthProfit: money.monthProfit,
    monthExpenses: money.monthExpenses,
    opexRunwayDays: money.runwayDays,
    dailyOpexRunRate: money.dailyOpex,
    attentionText: groups.map((g) => `${g.label}: ${g.total}`).join("; "),
  });

  try {
    const config = {
      responseMimeType: "application/json" as const,
    };
    const geminiData = await fetchGemini([{ role: "user", parts: [{ text: prompt }] }], config);
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    const parsed = safeParseJSON<SmartInsight[] | unknown>(rawText, null);
    const insights: SmartInsight[] = Array.isArray(parsed) ? (parsed as SmartInsight[]) : [];

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[ai-insights] fetch error:", err);
    // Збій моделі (rate limit, парсинг, мережа) — не валимо блок грошей поруч.
    if (err instanceof GeminiRateLimitError) {
      return NextResponse.json({ insights: [], rateLimited: true });
    }
    return NextResponse.json({ insights: [] });
  }
}
