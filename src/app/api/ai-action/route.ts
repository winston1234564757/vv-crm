import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

export async function POST(request: NextRequest) {
  // 1. Guard check: Must be authenticated user
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

      const prompt = `Ти — AI-аналітик VV CRM (магазин електроніки та сервісний центр в Україні).
Твоє завдання — скласти інтелектуальний психографічний профіль клієнта на основі його контактних даних та історії взаємодії з бізнесом.

Дані клієнта:
- Ім'я: ${customer.name}
- Нотатки: ${customer.notes ?? "немає"}
- Візитів усього: ${customer.total_visits}
- Витрачено всього: ${customer.total_spent} ₴
- VIP статус: ${customer.vip_status ?? "звичайний"}
- Нотатки про вподобання: ${customer.notes_about_preferences ?? "немає"}

Історія ремонтів:
${repairsText || "Немає попередніх ремонтів"}

Історія покупок:
${salesText || "Немає попередніх покупок"}

Сформуй об'єкт JSON зі структурою:
{
  "psychotype": "Короткий опис психотипу клієнта (до 5 слів, наприклад: 'Цінує якість та оригінальні деталі')",
  "tips": [
    "3 короткі поради для менеджера, як спілкуватися з цим клієнтом для успішного продажу або сервісу"
  ],
  "retention_risk": "low" або "medium" або "high" (оцінка ризику втрати клієнта),
  "summary": "Коротке резюме профілю та уподобань клієнта (2-3 речення, конкретно про історію покупок/ремонтів)"
}

Відповідай виключно валідним JSON об'єктом. Мова відповіді — українська.`;

      const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!geminiRes.ok) {
        throw new Error(`Gemini API returned ${geminiRes.status}`);
      }

      const resData = await geminiRes.json();
      const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsedProfile = JSON.parse(rawJsonText);

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

      const prompt = `Ти — привітний менеджер магазину та сервісного центру VV CRM.
Тобі потрібно написати повідомлення у Telegram/Viber для клієнта на ім'я ${customer.name}.

Психотип клієнта: ${psychotype}
Рекомендації для комунікації з ним: ${tips}

${contextPrompt}

Напиши персоналізоване повідомлення українською мовою. 
Вимоги до повідомлення:
1. Воно повинно максимально враховувати психотип (якщо клієнт цінує швидкість/стислість — пиши коротко і по суті; якщо техно-ентузіаст або прискіпливий — розпиши детальніше і підкресли якість; якщо чутливий до ціни — зроби акцент на вигоді та гарантії).
2. Має містити відповідні емодзі (наприклад, 📱, ✅, 💰).
3. Має бути повністю готовим до копіювання та відправки.
4. Не пиши жодних вступних фраз від себе, віддавай ТІЛЬКИ текст повідомлення у форматі JSON.

Поверни JSON у форматі:
{
  "message": "Текст повідомлення тут"
}

Відповідай виключно валідним JSON.`;

      const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!geminiRes.ok) {
        throw new Error(`Gemini API returned ${geminiRes.status}`);
      }

      const resData = await geminiRes.json();
      const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsedMessage = JSON.parse(rawJsonText);

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

      const prompt = `Ти — провідний AI-майстер та технічний експерт у VV CRM.
Твоє завдання — проаналізувати опис поломки пристрою та надати технічні рекомендації, можливі причини, кроки для діагностики, та підібрати сумісні деталі, які зараз є на складі.

Пристрій у ремонті:
- Назва: ${repair.device_name}
- Несправність: ${repair.issue}
- Замітки до ремонту: ${repair.notes ?? "немає"}

Запчастини, які зараз є НА НАШОМУ СКЛАДІ в наявності:
${partsText || "На складі деталей немає"}

Сформуй об'єкт JSON зі структурою:
{
  "possible_causes": [
    "3 найбільш ймовірні причини несправності"
  ],
  "required_parts": [
    "Перелік рекомендованих запчастин. Якщо на нашому складі вище є сумісна деталь — напиши її точну назву з позначкою '(Є на складі)', інакше вкажи загальну назву необхідної деталі"
  ],
  "estimated_difficulty": "easy" або "medium" або "hard",
  "step_by_step_guide": [
    "Покроковий гайд для майстра (4-5 кроків) з діагностики та усунення цієї конкретної проблеми на цьому пристрої"
  ],
  "time_estimate_hours": 2 (число, очікуваний чистий час роботи в годинах на ремонт)
}

Відповідай виключно валідним JSON об'єктом. Мова відповіді — українська.`;

      const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!geminiRes.ok) {
        throw new Error(`Gemini API returned ${geminiRes.status}`);
      }

      const resData = await geminiRes.json();
      const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsedDiagnostic = JSON.parse(rawJsonText);

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
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
