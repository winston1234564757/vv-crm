import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRole, type UserRole } from "@/lib/utils/rbac";
import { MONEY_ROLES } from "@/lib/roles";
import { fetchGemini, GeminiRateLimitError, type GeminiContent } from "@/lib/utils/gemini";
import {
  buildCustomerCopilotSystem,
  buildRepairCopilotSystem,
  buildFinanceCopilotSystem,
} from "@/lib/ai-prompts";
import { getFinanceReport } from "@/lib/data-finance";
import { splitByKind, isCashless } from "@/lib/utils/finance";

type ChatEntity = "customer" | "repair" | "finance";

/**
 * Роут читає дані через service-role клієнт в обхід RLS, тож права мусять
 * перевірятись тут — інакше будь-хто автентифікований дістає баланси кас.
 * Ключі цієї мапи водночас є білим списком `entityType`.
 */
const ROLES_BY_ENTITY: Record<ChatEntity, UserRole[]> = {
  customer: ["owner", "manager", "sales"],
  repair: ["owner", "manager", "technician"],
  finance: MONEY_ROLES,
};

function isChatEntity(value: unknown): value is ChatEntity {
  return typeof value === "string" && value in ROLES_BY_ENTITY;
}

export async function POST(request: NextRequest) {
  let body: {
    messages: Array<{ role: "user" | "model"; content: string }>;
    entityType: ChatEntity;
    entityId: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, entityType, entityId } = body;
  if (!messages || !entityType || !entityId) {
    return NextResponse.json(
      { error: "Missing required parameters: messages, entityType, entityId" },
      { status: 400 }
    );
  }

  if (!isChatEntity(entityType)) {
    return NextResponse.json({ error: "Unsupported entityType" }, { status: 400 });
  }

  const access = await checkRole(ROLES_BY_ENTITY[entityType]);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const adminClient = createAdminClient();
  let systemPrompt = "";

  try {
    if (entityType === "customer") {
      const { data: customer } = await adminClient
        .from("customers")
        .select("name, notes, total_visits, total_spent, ai_profile")
        .eq("id", entityId)
        .single();

      if (customer) {
        const profile = (customer.ai_profile as { psychotype?: string; summary?: string } | null) || {};
        systemPrompt = buildCustomerCopilotSystem({
          name: customer.name,
          notes: customer.notes,
          total_visits: customer.total_visits,
          total_spent: customer.total_spent,
          psychotype: profile.psychotype,
          summary: profile.summary,
        });
      } else {
        systemPrompt = "Ти — AI-асистент VV CRM. Клієнта не знайдено. Відповідай по суті.";
      }

    } else if (entityType === "repair") {
      const { data: repair } = await adminClient
        .from("repairs")
        .select("device_name, issue, notes, status, ai_diagnostic")
        .eq("id", entityId)
        .single();

      if (repair) {
        const diag = (repair.ai_diagnostic as {
          time_estimate_hours?: number;
          estimated_difficulty?: string;
          possible_causes?: string[];
        } | null) || {};

        systemPrompt = buildRepairCopilotSystem({
          device_name: repair.device_name,
          issue: repair.issue,
          notes: repair.notes,
          status: repair.status,
          time_estimate_hours: diag.time_estimate_hours,
          estimated_difficulty: diag.estimated_difficulty,
          possible_causes: diag.possible_causes,
        });
      } else {
        systemPrompt = "Ти — технічний AI-майстер VV CRM. Ремонт не знайдено. Відповідай по суті.";
      }

    } else if (entityType === "finance") {
      const [registersRes, safesRes] = await Promise.all([
        adminClient.from("cash_registers").select("name, balance, type"),
        adminClient.from("safes").select("name, balance, type"),
      ]);

      const registers = registersRes.data || [];
      const safes = safesRes.data || [];
      const report = await getFinanceReport("30d");
      const registerKinds = splitByKind(registers);

      // Рахунок безготівки прибираємо зі списку кас, а не лише з підсумку:
      // інакше промпт каже «Каси: 0 ₴ (…, Безготівка: 1300)» — сума й перелік
      // у тих самих дужках суперечать одне одному, і суперечність доводиться
      // латати припискою «не додавай». Безготівка йде окремим рядком нижче.
      const cashRegisters = registers.filter((r) => !isCashless(r.type));

      systemPrompt = buildFinanceCopilotSystem({
        totalCash: registerKinds.cash,
        totalSafes: safes.reduce((s, r) => s + r.balance, 0),
        totalExpenses: report.totalExpenses,
        totalRevenue: report.totalSales + report.repairsRevenue,
        profit: report.profit,
        registers: cashRegisters,
        safes,
      });

      // Безготівка (картка/переказ) — окремий рахунок, а не готівка в шухляді.
      // Без цього рядка модель дублює суму з розбивки кас і називає картку
      // готівкою.
      systemPrompt += `\nБезготівка (картка/переказ, ще не розподілена по сейфах): ${registerKinds.cashless} ₴. Це НЕ готівка — не додавай її до кас.`;
    }

    // Передаємо тільки реальну розмову — системний контекст йде через systemInstruction
    const formattedContents: GeminiContent[] = messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model" as const,
      parts: [{ text: msg.content }],
    }));

    const geminiData = await fetchGemini(
      formattedContents,
      undefined,
      3,
      15000,
      systemPrompt  // ← systemInstruction — окремий параметр API, не user-message
    );
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return NextResponse.json({ reply: rawText });

  } catch (error) {
    console.error("Error in ai-chat route:", error);

    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
