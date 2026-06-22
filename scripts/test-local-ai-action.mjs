import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://oihiryfvnsxdchwymbge.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9paGlyeWZ2bnN4ZGNod3ltYmdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MzE0OSwiZXhwIjoyMDk2NDI5MTQ5fQ.5oaDlsN_w3ewRavntgD6JZuXeCToilObb5WqqL6JdgE";

// Read API key from .env.local
const envContent = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
let apiKey = "";
envContent.split("\n").forEach(line => {
  if (line.startsWith("GEMINI_API_KEY=")) {
    apiKey = line.split("=")[1].trim().replace(/^"|"$/g, "");
  }
});

if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

async function testCustomerProfile(entityId) {
  console.log(`Testing customer profile generation for ID: ${entityId}...`);

  const { data: customer, error: custErr } = await adminClient
    .from("customers")
    .select("*")
    .eq("id", entityId)
    .single();

  if (custErr || !customer) {
    console.error("Customer not found:", custErr);
    return;
  }

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
    const itemsText = (s.sale_items ?? []).map(si => `${si.item_type} (${si.total_price} ₴)`).join(", ");
    return `- Покупка від ${s.created_at.split('T')[0]}: сума ${s.total_amount} ₴, товары: [${itemsText}]. Замітки: ${s.notes ?? "—"}`;
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
  "retention_risk": "low", "medium" або "high" (оцінка ризику втрати клієнта),
  "summary": "Коротке резюме профілю та уподобань клієнта (2-3 речення, конкретно про історію покупок/ремонтів)"
}

Відповідай виключно валідним JSON об'єктом. Мова відповіді — українська.`;

  console.log("Sending query to Gemini API...");
  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
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

    console.log("Gemini Status:", geminiRes.status, geminiRes.statusText);
    
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini Error response:", errText);
      return;
    }

    const resData = await geminiRes.json();
    console.log("Full Gemini Response:", JSON.stringify(resData, null, 2));
    const rawJsonText = resData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    console.log("Raw JSON Text from Gemini:", rawJsonText);
    
    const parsedProfile = JSON.parse(rawJsonText);
    console.log("✅ Parsed profile successfully!", JSON.stringify(parsedProfile, null, 2));
  } catch (err) {
    console.error("Execution error:", err);
  }
}

testCustomerProfile("32f520c7-75e0-42b2-9b57-30d16151449a");
