/**
 * VV CRM — Централізовані AI промпти
 * Джерело правди: src/lib/ai-prompts/PROMPTS.md
 *
 */

// ─── Глобальна інструкція стилю ──────────────────────────────────────────────
// Свобода для моделі, без жорстких обмежень.

// ─── 1. Customer Copilot ─────────────────────────────────────────────────────

export function buildCustomerCopilotSystem(customer: {
  name: string;
  notes?: string | null;
  total_visits: number;
  total_spent: number;
  psychotype?: string;
  summary?: string;
}): string {
  return `Ти — AI-асистент менеджера у VV CRM (магазин+сервіс). Клієнт: ${customer.name}.
Факти: візитів ${customer.total_visits}, витрачено ${customer.total_spent} ₴${customer.notes ? `, нотатки: ${customer.notes}` : ""}${customer.psychotype ? `, психотип: ${customer.psychotype}` : ""}${customer.summary ? `, резюме: ${customer.summary}` : ""}.`;
}

// ─── 2. Repair Copilot ───────────────────────────────────────────────────────

export function buildRepairCopilotSystem(repair: {
  device_name: string;
  issue: string;
  notes?: string | null;
  status: string;
  time_estimate_hours?: number;
  estimated_difficulty?: string;
  possible_causes?: string[];
}): string {
  const causes = Array.isArray(repair.possible_causes) && repair.possible_causes.length > 0
    ? repair.possible_causes.join("; ")
    : null;

  return `Ти — технічний майстер-експерт VV CRM. Пристрій: ${repair.device_name}. Несправність: ${repair.issue}. Статус: ${repair.status}${repair.notes ? `. Нотатки: ${repair.notes}` : ""}${repair.estimated_difficulty ? `. Складність: ${repair.estimated_difficulty}` : ""}${causes ? `. Можливі причини: ${causes}` : ""}.`;
}

// ─── 3. Finance Copilot ──────────────────────────────────────────────────────

export function buildFinanceCopilotSystem(finance: {
  totalCash: number;
  totalSafes: number;
  totalExpenses: number;
  totalRevenue: number;
  profit: number;
  registers: Array<{ name: string; balance: number; type: string }>;
  safes: Array<{ name: string; balance: number; type: string }>;
}): string {
  const registersStr = finance.registers.map(r => `${r.name}: ${r.balance} ₴`).join(", ");
  const safesStr = finance.safes.map(s => `${s.name}: ${s.balance} ₴`).join(", ");

  return `Ти — фінансовий директор малого бізнесу VV CRM (Україна). Дані за 30 днів:
Каси: ${finance.totalCash} ₴ (${registersStr || "немає"}). Сейфи: ${finance.totalSafes} ₴ (${safesStr || "немає"}). Витрати: ${finance.totalExpenses} ₴. Дохід: ${finance.totalRevenue} ₴. Прибуток: ${finance.profit} ₴.`;
}

// ─── 4. Customer Profile (JSON) ──────────────────────────────────────────────

export function buildCustomerProfilePrompt(customer: {
  name: string;
  notes?: string | null;
  total_visits: number;
  total_spent: number;
  vip_status?: string | null;
  notes_about_preferences?: string | null;
}, repairsText: string, salesText: string): string {
  return `Аналітик VV CRM. Склади психографічний профіль клієнта. Будь конкретним, без води.

Клієнт: ${customer.name}. Візитів: ${customer.total_visits}. Витрати: ${customer.total_spent} ₴. VIP: ${customer.vip_status ?? "ні"}${customer.notes ? `. Нотатки: ${customer.notes}` : ""}${customer.notes_about_preferences ? `. Вподобання: ${customer.notes_about_preferences}` : ""}.
Ремонти: ${repairsText || "немає"}.
Покупки: ${salesText || "немає"}.

Поверни ТІЛЬКИ валідний JSON (без markdown):
{"psychotype":"до 5 слів — хто цей клієнт","tips":["порада менеджеру 1","порада 2","порада 3"],"retention_risk":"low|medium|high","summary":"2 речення про клієнта, конкретно по даних"}`;
}

// ─── 5. Customer Message (JSON) ──────────────────────────────────────────────

export function buildCustomerMessagePrompt(params: {
  customerName: string;
  psychotype: string;
  tips: string;
  contextPrompt: string;
}): string {
  return `Напиши Telegram/Viber повідомлення для ${params.customerName}. Психотип: ${params.psychotype}. Тон: ${params.tips}.
${params.contextPrompt}

Вимоги: персоналізовано, з емодзі, готове до відправки. Без вступу від себе.
Поверни ТІЛЬКИ JSON: {"message":"текст"}`;
}

// ─── 6. Repair Diagnose (JSON) ───────────────────────────────────────────────

export function buildRepairDiagnosePrompt(repair: {
  device_name: string;
  issue: string;
  notes?: string | null;
}, partsText: string): string {
  return `Технічний експерт VV CRM. Діагностуй ремонт, підбери запчастини зі складу.

Пристрій: ${repair.device_name}. Несправність: ${repair.issue}${repair.notes ? `. Нотатки: ${repair.notes}` : ""}.
Склад: ${partsText || "порожній"}.

Поверни ТІЛЬКИ валідний JSON (без markdown):
{"possible_causes":["причина 1","причина 2","причина 3"],"required_parts":["деталь (Є на складі) або загальна назва"],"estimated_difficulty":"easy|medium|hard","step_by_step_guide":["крок 1","крок 2","крок 3","крок 4"],"time_estimate_hours":2}`;
}

// ─── 7. Business Insights (JSON array) ──────────────────────────────────────

export function buildInsightsPrompt(data: {
  rangeLabel: string;
  revenue: number;
  profit: number;
  marginPercent: number;
  byCategoryText: string;
  dailyTarget: number | null;
  monthlyTarget: number | null;
  monthProfit: number;
  monthExpenses: number;
  opexRunwayDays: number;
  dailyOpexRunRate: number;
  attentionText: string;
}): string {
  const targets =
    [
      data.dailyTarget ? `день ${data.dailyTarget} ₴` : null,
      data.monthlyTarget ? `місяць ${data.monthlyTarget} ₴` : null,
    ]
      .filter(Boolean)
      .join(", ") || "не задані";

  return `Бізнес-аналітик VV CRM. Дай 3-4 actionable інсайти. Тільки цифри і дії, без води.

Магазин відкрито 24.07.2026 — історії мало, не роби висновків про тренди й сезонність.

${data.rangeLabel}: виторг ${data.revenue} ₴, прибуток ${data.profit} ₴, маржа ${data.marginPercent}%.
По категоріях: ${data.byCategoryText}.
Цілі по прибутку: ${targets}.
Місяць: прибуток ${data.monthProfit} ₴, витрати ${data.monthExpenses} ₴, чистий ${data.monthProfit - data.monthExpenses} ₴.
OPEX: ${data.opexRunwayDays} днів резерву (${data.dailyOpexRunRate} ₴/день).
Потребує уваги: ${data.attentionText || "нічого"}.

Поверни ТІЛЬКИ JSON масив (без markdown):
[{"type":"opportunity|warning|achievement|info","title":"емодзі + до 6 слів","description":"1-2 речення з цифрами і конкретною дією","action":"до 4 слів","impact":"high|medium|low"}]`;
}
