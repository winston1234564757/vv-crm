import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGemini, GeminiRateLimitError, safeParseJSON } from "@/lib/utils/gemini";
import { buildCustomerProfilePrompt, buildCustomerMessagePrompt, buildRepairDiagnosePrompt } from "@/lib/ai-prompts";
import type { Json } from "@/types/database";

export async function POST(request: NextRequest) {
  // 1. Guard check: Must be authenticated user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action: string; entityId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, entityId } = body;
  if (!action || !entityId) {
    return NextResponse.json(
      { error: "Missing required parameters: action, entityId" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  try {
    if (action === "generate_customer_profile") {
      // Fetch Customer Info
      const { data: customer, error: custErr } = await adminClient
        .from("customers")
        .select("*")
        .eq("id", entityId)
        .single();

      if (custErr || !customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      // Fetch Customer Repairs and Sales History
      const [repairsRes, salesRes] = await Promise.all([
        adminClient
          .from("repairs")
          .select("device_name, issue, status, price, notes, created_at")
          .eq("customer_id", entityId)
          .order("created_at", { ascending: false }),
        adminClient
          .from("sales")
          .select("total_amount, discount, notes, created_at, sale_items(item_type, total_price)")
          .eq("customer_id", entityId)
          .order("created_at", { ascending: false })
      ]);

      const repairsText = (repairsRes.data ?? []).map(r => 
        `- Ремонт: ${r.device_name}. Несправність: ${r.issue}. Статус: ${r.status}. Вартість: ${r.price} ₴. Замітки: ${r.notes ?? "—"}`
      ).join("\n");

      const salesText = (salesRes.data ?? []).map(s => {
        const itemsText = (s.sale_items as { item_type: string; total_price: number }[] ?? []).map(si => `${si.item_type} (${si.total_price} ₴)`).join(", ");
        return `- Покупка від ${s.created_at.split('T')[0]}: сума ${s.total_amount} ₴, товари: [${itemsText}]. Замітки: ${s.notes ?? "—"}`;
      }).join("\n");

      const prompt = buildCustomerProfilePrompt(
        {
          name: customer.name,
          notes: customer.notes,
          total_visits: customer.total_visits,
          total_spent: customer.total_spent,
          vip_status: customer.vip_status,
          notes_about_preferences: customer.notes_about_preferences,
        },
        repairsText,
        salesText
      );

      const config = {
        responseMimeType: "application/json" as const,
      };
      const resData = await fetchGemini([{ role: "user", parts: [{ text: prompt }] }], config);
      const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsedProfile = safeParseJSON<Json>(rawJsonText, {});

      // Cache / Save back to database
      const { error: updateErr } = await adminClient
        .from("customers")
        .update({ ai_profile: parsedProfile })
        .eq("id", entityId);

      if (updateErr) {
        console.error("Error updating customer ai_profile:", updateErr);
      }

      return NextResponse.json({ profile: parsedProfile });

    } else if (action === "generate_customer_message") {
      const { templateType = "repair_ready" } = body as { templateType?: string };

      // Fetch Customer Info
      const { data: customer, error: custErr } = await adminClient
        .from("customers")
        .select("name, ai_profile")
        .eq("id", entityId)
        .single();

      if (custErr || !customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      const profile = customer.ai_profile as { psychotype?: string; tips?: string[]; summary?: string } | null;
      const psychotype = profile?.psychotype || "звичайний клієнт";
      const tips = Array.isArray(profile?.tips) ? profile.tips.join(", ") : "спілкуватися ввічливо";

      // Fetch latest repair to get device context
      const { data: latestRepair } = await adminClient
        .from("repairs")
        .select("device_name, price, tracking_token")
        .eq("customer_id", entityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const deviceName = latestRepair?.device_name || "ваш пристрій";
      const price = latestRepair?.price || 0;
      const trackingUrl = latestRepair?.tracking_token 
        ? `https://vv-crm.vercel.app/repair/${latestRepair.tracking_token}`
        : "";

      let contextPrompt = "";
      if (templateType === "repair_ready") {
        contextPrompt = `Тема: Повідомлення про готовність ремонту. 
Деталі ремонту:
- Пристрій: ${deviceName}
- Ціна роботи/запчастин: ${price} ₴
${trackingUrl ? `- Посилання для детального перегляду статусу гарантії: ${trackingUrl}` : ""}`;
      } else {
        contextPrompt = `Тема: Персоналізована акційна пропозиція (знижка на аксесуари або чистку пристрою).
Запропонуй клієнту вигідну послугу або аксесуар, враховуючи, що він ремонтував ${deviceName}.`;
      }

      const prompt = buildCustomerMessagePrompt({
        customerName: customer.name,
        psychotype,
        tips,
        contextPrompt,
      });

      const config = {
        responseMimeType: "application/json" as const,
      };
      const resData = await fetchGemini([{ role: "user", parts: [{ text: prompt }] }], config);
      const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsedMessage = safeParseJSON<{ message?: string }>(rawJsonText, {});

      return NextResponse.json({ message: parsedMessage?.message || "" });

    } else if (action === "diagnose_repair") {
      // Fetch Repair Info
      const { data: repair, error: repErr } = await adminClient
        .from("repairs")
        .select("*")
        .eq("id", entityId)
        .single();

      if (repErr || !repair) {
        return NextResponse.json({ error: "Repair not found" }, { status: 404 });
      }

      // Fetch parts in stock to match compatibility
      const { data: parts } = await adminClient
        .from("parts")
        .select("name, stock, price, compatible_with")
        .gt("stock", 0);

      const partsText = (parts ?? []).map(p => 
        `- ${p.name} (в наявності: ${p.stock} шт, ціна: ${p.price} ₴, сумісність: ${p.compatible_with ?? "не вказано"})`
      ).join("\n");

      const prompt = buildRepairDiagnosePrompt(
        {
          device_name: repair.device_name,
          issue: repair.issue,
          notes: repair.notes,
        },
        partsText
      );

      const config = {
        responseMimeType: "application/json" as const,
      };
      const resData = await fetchGemini([{ role: "user", parts: [{ text: prompt }] }], config);
      const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsedDiagnostic = safeParseJSON<Json>(rawJsonText, {});

      // Cache / Save back to database
      const { error: updateErr } = await adminClient
        .from("repairs")
        .update({ ai_diagnostic: parsedDiagnostic })
        .eq("id", entityId);

      if (updateErr) {
        console.error("Error updating repair ai_diagnostic:", updateErr);
      }

      return NextResponse.json({ diagnostic: parsedDiagnostic });

    } else {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in ai-action route:", error);

    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
