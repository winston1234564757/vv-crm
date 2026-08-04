import { describe, it, expect } from "vitest";
import { buildBridge, netWorth, type BridgeInput } from "../bridge";

function input(over: Partial<BridgeInput> = {}): BridgeInput {
  return {
    netProfit: 0,
    inventoryDelta: 0,
    deferredRevenue: 0,
    receivablesDelta: 0,
    payablesDelta: 0,
    capitalExpenses: 0,
    ownerContributions: 0,
    ownerDraws: 0,
    adjustments: 0,
    actualCashChange: 0,
    ...over,
  };
}

describe("buildBridge", () => {
  it("без жодних поправок гроші дорівнюють прибутку", () => {
    const b = buildBridge(input({ netProfit: 1000, actualCashChange: 1000 }));
    expect(b.explained).toBe(1000);
    expect(b.unexplained).toBe(0);
    expect(b.balanced).toBe(true);
  });

  it("товар на складі з'їдає гроші, яких прибуток не бачить", () => {
    // Заробили 1 000, але закупили товару на 800 — у касі лишилось 200.
    const b = buildBridge(
      input({ netProfit: 1000, inventoryDelta: 800, actualCashChange: 200 }),
    );
    expect(b.lines.find((l) => l.key === "inventory")!.amount).toBe(-800);
    expect(b.unexplained).toBe(0);
  });

  it("внесок власника додає гроші, не додаючи прибутку", () => {
    const b = buildBridge(
      input({ netProfit: 0, ownerContributions: 14569, actualCashChange: 14569 }),
    );
    expect(b.balanced).toBe(true);
  });

  it("вилучення забирає гроші, не забираючи прибутку", () => {
    const b = buildBridge(input({ netProfit: 0, ownerDraws: 23759, actualCashChange: -23759 }));
    expect(b.balanced).toBe(true);
  });

  it("борг постачальникам тримає касу повнішою", () => {
    const b = buildBridge(input({ netProfit: 0, payablesDelta: 500, actualCashChange: 500 }));
    expect(b.lines.find((l) => l.key === "payables")!.amount).toBe(500);
    expect(b.balanced).toBe(true);
  });

  /* Найважливіший тест модуля. Спокуса зробити нев'язку балансуючим рядком
     велика — тоді звіт завжди сходиться. І тоді він нічого не ловить. */
  it("нев'язку показує, а не ховає", () => {
    const b = buildBridge(input({ netProfit: 1000, actualCashChange: 700 }));
    expect(b.explained).toBe(1000);
    expect(b.actual).toBe(700);
    expect(b.unexplained).toBe(-300);
    expect(b.balanced).toBe(false);
    // І жоден рядок не «з'їв» різницю мовчки.
    expect(b.lines.reduce((s, l) => s + l.amount, 0)).toBe(0);
  });

  /* Фіксація справжніх чисел магазину з епохи (21.07) на 04.08.2026, знятих
     SQL-запитами до прода.

     Наївна версія цього містка не сходилась на 1 950 ₴, і саме розбір НЕ-нуля
     показав, чого бракує: 1 600 ₴ оплачених наперед ремонтів і замовлень та
     600 ₴ витрат із сейфа ЧП, які насправді є вилученням частки. Якби
     нев'язку тоді закрили балансуючим рядком, обидві статті лишились би
     невидимими назавжди. Цей тест стереже саме той висновок. */
  it("сходиться в нуль на реальних числах магазину", () => {
    const b = buildBridge({
      netProfit: 25385,
      // куплено 28 074, списано 28 733 (товар) + 950 (деталі в ремонти)
      inventoryDelta: 28074 - (28733 + 950),
      deferredRevenue: 1400 + 200,
      receivablesDelta: 0,
      payablesDelta: 0,
      capitalExpenses: 4650,
      ownerContributions: 14569,
      ownerDraws: 23759 + 600, // + витрати з сейфа ЧП
      adjustments: -854,
      actualCashChange: 17650 - 4350,
    });

    expect(b.actual).toBe(13300);
    expect(b.explained).toBe(13300);
    expect(b.unexplained).toBe(0);
    expect(b.balanced).toBe(true);
  });

  it("рядки завжди всі й завжди в тому самому порядку", () => {
    const empty = buildBridge(input());
    const full = buildBridge(input({ netProfit: 5, inventoryDelta: 5, actualCashChange: 0 }));
    expect(empty.lines.map((l) => l.key)).toEqual(full.lines.map((l) => l.key));
    expect(empty.lines).toHaveLength(8);
  });

  it("кожен рядок пояснює себе текстом", () => {
    for (const l of buildBridge(input()).lines) {
      expect(l.hint.length).toBeGreaterThan(0);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });
});

describe("netWorth", () => {
  // Справжні числа на 04.08.2026.
  const real = {
    registers: 5250,
    safes: 12400,
    devicesAtCost: 8750,
    accessoriesAtCost: 8444,
    partsAtCost: 5092,
    receivables: 0,
    payables: 0,
    ownerCount: 2,
  };

  it("зводить усе, що є, в одне число", () => {
    const w = netWorth(real);
    expect(w.liquid).toBe(17650);
    expect(w.inventory).toBe(22286);
    expect(w.total).toBe(39936);
  });

  it("ділить порівну між власниками", () => {
    expect(netWorth(real).perOwner).toBe(19968);
  });

  it("борг постачальникам зменшує вартість", () => {
    const w = netWorth({ ...real, payables: 5000 });
    expect(w.total).toBe(39936 - 5000);
  });

  it("борг клієнтів збільшує", () => {
    expect(netWorth({ ...real, receivables: 1000 }).total).toBe(39936 + 1000);
  });

  it("нуль власників не дає Infinity на екрані", () => {
    expect(netWorth({ ...real, ownerCount: 0 }).perOwner).toBe(39936);
  });

  it("склад іде за собівартістю, тож порожній магазин коштує лише грошей", () => {
    const w = netWorth({ ...real, devicesAtCost: 0, accessoriesAtCost: 0, partsAtCost: 0 });
    expect(w.total).toBe(w.liquid);
    expect(w.inventory).toBe(0);
  });
});
