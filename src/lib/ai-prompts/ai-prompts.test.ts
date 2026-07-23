/**
 * Тести для src/lib/ai-prompts/index.ts
 *
 * Перевіряємо що кожна prompt-функція:
 * - містить правильні дані клієнта/ремонту/фінансів
 * - вимагає JSON-відповідь
 * - не містить порожніх полів при відсутніх даних
 */

import { describe, it, expect } from "vitest";
import {
  buildCustomerCopilotSystem,
  buildRepairCopilotSystem,
  buildFinanceCopilotSystem,
  buildCustomerProfilePrompt,
  buildCustomerMessagePrompt,
  buildRepairDiagnosePrompt,
  buildInsightsPrompt,
} from "@/lib/ai-prompts";

// ─── Customer Copilot ─────────────────────────────────────────────────────────

describe("buildCustomerCopilotSystem", () => {
  it("містить ім'я клієнта", () => {
    const result = buildCustomerCopilotSystem({
      name: "Олег Петренко",
      total_visits: 3,
      total_spent: 1500,
    });
    expect(result).toContain("Олег Петренко");
  });

  it("містить статистику візитів і витрат", () => {
    const result = buildCustomerCopilotSystem({
      name: "Тест",
      total_visits: 7,
      total_spent: 9999,
    });
    expect(result).toContain("7");
    expect(result).toContain("9999");
  });

  it("включає психотип якщо переданий", () => {
    const result = buildCustomerCopilotSystem({
      name: "Тест",
      total_visits: 1,
      total_spent: 100,
      psychotype: "технічний ентузіаст",
    });
    expect(result).toContain("технічний ентузіаст");
  });

  it("не містить 'undefined' якщо поля відсутні", () => {
    const result = buildCustomerCopilotSystem({
      name: "Тест",
      total_visits: 0,
      total_spent: 0,
    });
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("null");
  });

});

// ─── Repair Copilot ───────────────────────────────────────────────────────────

describe("buildRepairCopilotSystem", () => {
  it("містить назву пристрою і несправність", () => {
    const result = buildRepairCopilotSystem({
      device_name: "iPhone 14 Pro",
      issue: "Не заряджається",
      status: "in_progress",
    });
    expect(result).toContain("iPhone 14 Pro");
    expect(result).toContain("Не заряджається");
  });

  it("включає possible_causes якщо є", () => {
    const result = buildRepairCopilotSystem({
      device_name: "Samsung S23",
      issue: "Чорний екран",
      status: "diagnostics",
      possible_causes: ["Несправний дисплей", "Проблема з платою"],
    });
    expect(result).toContain("Несправний дисплей");
    expect(result).toContain("Проблема з платою");
  });

  it("не містить 'undefined' при відсутніх опціональних полях", () => {
    const result = buildRepairCopilotSystem({
      device_name: "Тест",
      issue: "Тест несправності",
      status: "received",
    });
    expect(result).not.toContain("undefined");
  });
});

// ─── Finance Copilot ──────────────────────────────────────────────────────────

describe("buildFinanceCopilotSystem", () => {
  it("містить фінансові показники", () => {
    const result = buildFinanceCopilotSystem({
      totalCash: 15000,
      totalSafes: 5000,
      totalExpenses: 3000,
      totalRevenue: 20000,
      profit: 17000,
      registers: [{ name: "Каса 1", balance: 15000, type: "cash" }],
      safes: [{ name: "Сейф", balance: 5000, type: "safe" }],
    });
    expect(result).toContain("15000");
    expect(result).toContain("17000");
    expect(result).toContain("Каса 1");
  });

  it("показує 'немає' якщо регістри порожні", () => {
    const result = buildFinanceCopilotSystem({
      totalCash: 0,
      totalSafes: 0,
      totalExpenses: 0,
      totalRevenue: 0,
      profit: 0,
      registers: [],
      safes: [],
    });
    expect(result).toContain("немає");
  });
});

// ─── Customer Profile Prompt ──────────────────────────────────────────────────

describe("buildCustomerProfilePrompt", () => {
  it("вимагає JSON у відповіді (без markdown)", () => {
    const result = buildCustomerProfilePrompt(
      { name: "Тест", total_visits: 1, total_spent: 100 },
      "Ремонт iPhone",
      "Покупка кабелю"
    );
    expect(result).toContain("JSON");
    expect(result).toContain("без markdown");
  });

  it("містить поля psychotype, tips, retention_risk, summary", () => {
    const result = buildCustomerProfilePrompt(
      { name: "Тест", total_visits: 1, total_spent: 100 },
      "",
      ""
    );
    expect(result).toContain("psychotype");
    expect(result).toContain("tips");
    expect(result).toContain("retention_risk");
    expect(result).toContain("summary");
  });

  it("включає текст ремонтів якщо переданий", () => {
    const repairsText = "- Ремонт: iPhone 13. Несправність: екран.";
    const result = buildCustomerProfilePrompt(
      { name: "Тест", total_visits: 2, total_spent: 500 },
      repairsText,
      ""
    );
    expect(result).toContain("iPhone 13");
  });
});

// ─── Customer Message Prompt ──────────────────────────────────────────────────

describe("buildCustomerMessagePrompt", () => {
  it("включає ім'я і психотип клієнта", () => {
    const result = buildCustomerMessagePrompt({
      customerName: "Марія",
      psychotype: "технічний ентузіаст",
      tips: "говорити по суті",
      contextPrompt: "Ремонт готовий",
    });
    expect(result).toContain("Марія");
    expect(result).toContain("технічний ентузіаст");
  });

  it("вимагає JSON: {message: ...}", () => {
    const result = buildCustomerMessagePrompt({
      customerName: "Тест",
      psychotype: "звичайний",
      tips: "ввічливо",
      contextPrompt: "Контекст",
    });
    expect(result).toContain('"message"');
    expect(result).toContain("JSON");
  });
});

// ─── Repair Diagnose Prompt ───────────────────────────────────────────────────

describe("buildRepairDiagnosePrompt", () => {
  it("містить назву пристрою і несправність", () => {
    const result = buildRepairDiagnosePrompt(
      { device_name: "Xiaomi Note 12", issue: "Не вмикається" },
      "- Акумулятор (в наявності: 3 шт)"
    );
    expect(result).toContain("Xiaomi Note 12");
    expect(result).toContain("Не вмикається");
    expect(result).toContain("Акумулятор");
  });

  it("вимагає JSON з полями possible_causes, step_by_step_guide, time_estimate_hours", () => {
    const result = buildRepairDiagnosePrompt(
      { device_name: "Тест", issue: "Тест" },
      ""
    );
    expect(result).toContain("possible_causes");
    expect(result).toContain("step_by_step_guide");
    expect(result).toContain("time_estimate_hours");
  });

  it("показує 'порожній' якщо склад пустий", () => {
    const result = buildRepairDiagnosePrompt(
      { device_name: "Тест", issue: "Тест" },
      ""
    );
    expect(result).toContain("порожній");
  });
});

// ─── Insights Prompt ──────────────────────────────────────────────────────────

describe("buildInsightsPrompt", () => {
  const basePayload = {
    rangeLabel: "Сьогодні",
    revenue: 3800,
    profit: 1227,
    marginPercent: 32,
    byCategoryText: "Техніка 3000 ₴ / 650 ₴ / 22%; Аксесуари 700 ₴ / 477 ₴ / 68%",
    dailyTarget: 2000,
    monthlyTarget: 40000,
    monthProfit: 3975,
    monthExpenses: 5050,
    opexRunwayDays: 22,
    dailyOpexRunRate: 168,
    attentionText: "Ремонти без руху понад 14 днів: 3; Час замовляти: 32",
  };

  it("carries the profit and margin into the prompt", () => {
    const result = buildInsightsPrompt(basePayload);
    expect(result).toContain("1227");
    expect(result).toContain("32%");
  });

  it("states the net result for the month rather than making the model derive it", () => {
    expect(buildInsightsPrompt(basePayload)).toContain("-1075");
  });

  it("says targets are unset instead of printing null", () => {
    const result = buildInsightsPrompt({
      ...basePayload,
      dailyTarget: null,
      monthlyTarget: null,
    });
    expect(result).toContain("не задані");
    expect(result).not.toContain("null");
  });

  it("warns the model off trend claims, since the shop just opened", () => {
    expect(buildInsightsPrompt(basePayload)).toContain("24.07.2026");
  });
});
