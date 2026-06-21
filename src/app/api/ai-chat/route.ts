import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

export async function POST(request: NextRequest) {
  // 1. Guard check: Must be authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: {
    messages: Array<{ role: "user" | "model"; content: string }>;
    entityType: "customer" | "repair";
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

  const adminClient = createAdminClient();
  let systemPrompt = "";

  try {
    if (entityType === "customer") {
      // Fetch Customer profile info
      const { data: customer } = await adminClient
        .from("customers")
        .select("name, notes, total_visits, total_spent, ai_profile")
        .eq("id", entityId)
        .single();

      if (customer) {
        const profile = (customer.ai_profile as { psychotype?: string; summary?: string } | null) || {};
        systemPrompt = `Ти — AI-копілот VV CRM. Твоя мета — допомагати менеджеру працювати з клієнтом на ім'я ${customer.name}.
Контекст про клієнта:
- Нотатки: ${customer.notes ?? "немає"}
- Кількість візитів: ${customer.total_visits}
- Витрачено всього: ${customer.total_spent} ₴
- ШІ Психотип: ${profile.psychotype ?? "не визначено"}
- ШІ Резюме: ${profile.summary ?? "немає"}

Будь доброзичливим, відповідай українською мовою. Допомагай вирішувати питання щодо угод, порад з комунікації, персональних знижок та утримання клієнта.`;
      } else {
        systemPrompt = `Ти — AI-копілот VV CRM. Допомагаєш менеджеру працювати з клієнтом. Клієнта не знайдено в БД.`;
      }
    } else if (entityType === "repair") {
      // Fetch Repair info
      const { data: repair } = await adminClient
        .from("repairs")
        .select("device_name, issue, notes, status, price, ai_diagnostic")
        .eq("id", entityId)
        .single();

      if (repair) {
        const diag = (repair.ai_diagnostic as { time_estimate_hours?: number; estimated_difficulty?: string; possible_causes?: string[] } | null) || {};
        systemPrompt = `Ти — ШІ-експерт та технічний копілот сервісного центру VV CRM. Твоя мета — допомогти майстру відремонтувати пристрій ${repair.device_name}.
Контекст про ремонт:
- Заявлена несправність: ${repair.issue}
- Замітки майстра: ${repair.notes ?? "немає"}
- Поточний статус ремонту: ${repair.status}
- Очікуваний час роботи: ${diag.time_estimate_hours ?? "не оцінено"} год.
- Складність: ${diag.estimated_difficulty ?? "не визначена"}
- Можливі причини поломки: ${Array.isArray(diag.possible_causes) ? diag.possible_causes.join(", ") : "немає"}

Надавай майстру технічні поради, кроки з діагностики, перевірки схем, сумісності деталей чи пайки. Відповідай професійно, технічною мовою, але зрозуміло, українською.`;
      } else {
        systemPrompt = `Ти — технічний AI-копілот VV CRM. Допомагаєш майстру розібратися з ремонтом. Ремонт не знайдено в БД.`;
      }
    } else if (entityType === "finance") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      const [registersRes, safesRes, expensesRes, salesRes, repairsRes] = await Promise.all([
        adminClient.from("cash_registers").select("name, balance, type"),
        adminClient.from("safes").select("name, balance, type"),
        adminClient.from("expenses").select("amount, description, created_at").gte("created_at", thirtyDaysAgoStr),
        adminClient.from("sales").select("total_amount, created_at").gte("created_at", thirtyDaysAgoStr),
        adminClient.from("repairs").select("price, cost, status, created_at").in("status", ["completed", "handed_over"]).gte("created_at", thirtyDaysAgoStr),
      ]);

      const registers = registersRes.data || [];
      const safes = safesRes.data || [];
      const expenses = expensesRes.data || [];
      const sales = salesRes.data || [];
      const repairs = repairsRes.data || [];

      const totalCash = registers.reduce((sum, r) => sum + r.balance, 0);
      const totalSafes = safes.reduce((sum, s) => sum + s.balance, 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalSalesRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
      const totalRepairsRevenue = repairs.reduce((sum, r) => sum + r.price, 0);
      const totalRevenue = totalSalesRevenue + totalRepairsRevenue;
      const profit = totalRevenue - totalExpenses;

      systemPrompt = `Ти — AI-фінансовий аналітик та радник сервісного центру та магазину VV CRM в Україні.
Твоя мета — аналізувати фінансовий стан підприємства, оцінювати ліквідність, допомагати оптимізувати операційні витрати (OPEX) та прогнозувати касові розриви.

Поточний фінансовий стан підприємства (за останні 30 днів):
- Вільні кошти в касах: ${totalCash} ₴
- Резерви в сейфах: ${totalSafes} ₴
- Операційні витрати (OPEX): ${totalExpenses} ₴
- Оборот з продажів: ${totalSalesRevenue} ₴
- Дохід від ремонтів: ${totalRepairsRevenue} ₴
- Загальний дохід: ${totalRevenue} ₴
- Операційний прибуток: ${profit} ₴

Деталі поточних кас:
${registers.map(r => `- Каса "${r.name}" (${r.type}): ${r.balance} ₴`).join("\n")}

Деталі сейфів:
${safes.map(s => `- Сейф "${s.name}" (${s.type}): ${s.balance} ₴`).join("\n")}

Надавай аналіз професійно, але людською мовою, українською. Давай практичні поради щодо оптимізації витрат та балансування касових лімітів.`;
    }

    // Format messages for Gemini API
    // Gemini takes contents structure: [{ role: "user" | "model", parts: [{ text: "..." }] }]
    const formattedContents = [
      // Prepend system prompt as first developer/user instruction to keep context
      {
        role: "user",
        parts: [{ text: `СИСТЕМНИЙ КОНТЕКСТ (Візьми до уваги перед відповіддю): ${systemPrompt}` }]
      },
      {
        role: "model",
        parts: [{ text: "Зрозуміло. Я готовий допомагати власнику та майстру VV CRM у контексті цієї сутності." }]
      },
      ...messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }))
    ];

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: formattedContents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
        },
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!geminiRes.ok) {
      throw new Error(`Gemini API returned status ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return NextResponse.json({ reply: rawText });
  } catch (error) {
    console.error("Error in ai-chat route:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
