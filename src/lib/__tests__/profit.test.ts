import { describe, it, expect } from "vitest";
import {
  itemCost,
  computeProfit,
  margin,
  resolveRange,
  type ProfitSale,
  type ProfitSaleItem,
  type ProfitDeviceCost,
} from "../profit";

const DEV = new Map<string, ProfitDeviceCost>([
  ["tecno-8p", { cost_price: 600, repair_cost: 950 }],
  ["redmi-a5", { cost_price: 1000, repair_cost: 0 }],
  ["no-repair", { cost_price: 700, repair_cost: null }],
]);

function item(over: Partial<ProfitSaleItem> = {}): ProfitSaleItem {
  return {
    item_type: "accessory",
    item_id: "acc-1",
    quantity: 1,
    total_price: 100,
    unit_cost: 30,
    ...over,
  };
}

/** Один чек з переданих позицій. За замовчуванням без знижки. */
function sale(items: ProfitSaleItem[], discount: number | null = 0): ProfitSale {
  return { discount, items };
}

describe("itemCost", () => {
  it("adds the invested repair to a device cost", () => {
    // Регресія: sale_items.unit_cost дорівнює cost_price і ремонт губиться.
    const it_ = item({ item_type: "device", item_id: "tecno-8p", unit_cost: 600 });
    expect(itemCost(it_, DEV)).toBe(1550);
  });

  it("treats a null repair_cost as zero, not NaN", () => {
    const it_ = item({ item_type: "device", item_id: "no-repair", unit_cost: 700 });
    expect(itemCost(it_, DEV)).toBe(700);
  });

  it("falls back to the stored unit_cost when the device is unknown", () => {
    // Пристрій видалили — краще занижена собівартість, ніж нуль.
    const it_ = item({ item_type: "device", item_id: "ghost", unit_cost: 800 });
    expect(itemCost(it_, DEV)).toBe(800);
  });

  it("multiplies a non-device cost by quantity", () => {
    expect(itemCost(item({ quantity: 3, unit_cost: 30 }), DEV)).toBe(90);
  });

  it("multiplies a device cost by quantity too", () => {
    const it_ = item({ item_type: "device", item_id: "tecno-8p", quantity: 2, unit_cost: 600 });
    expect(itemCost(it_, DEV)).toBe(3100);
  });

  it("treats a null quantity as one, not zero", () => {
    const it_ = item({ quantity: null as unknown as number, unit_cost: 30 });
    expect(itemCost(it_, DEV)).toBe(30);
  });

  it("keeps an explicit zero quantity at zero cost, not one", () => {
    const it_ = item({ quantity: 0, unit_cost: 30 });
    expect(itemCost(it_, DEV)).toBe(0);
  });
});

describe("margin", () => {
  it("normalizes a small loss that rounds to zero to +0, not -0", () => {
    const m = margin(1000, -3);
    expect(m).toBe(0);
    expect(Object.is(m, -0)).toBe(false);
  });
});

describe("computeProfit", () => {
  it("reports the real margin on the Tecno 8P, not the inflated one", () => {
    // Купівля 600 + ремонт 950, продаж 2000. Зламаний unit_cost дав би 70%.
    const res = computeProfit(
      [sale([item({ item_type: "device", item_id: "tecno-8p", total_price: 2000, unit_cost: 600 })])],
      DEV,
      [],
    );
    expect(res.revenue).toBe(2000);
    expect(res.cost).toBe(1550);
    expect(res.profit).toBe(450);
    expect(res.margin).toBe(23);
  });

  it("splits revenue and profit by category", () => {
    const res = computeProfit(
      [
        sale([
          item({ item_type: "device", item_id: "redmi-a5", total_price: 2000, unit_cost: 1000 }),
          item({ item_type: "accessory", total_price: 700, unit_cost: 223 }),
          item({ item_type: "service", total_price: 100, unit_cost: 0 }),
        ]),
      ],
      DEV,
      [],
    );
    const by = Object.fromEntries(res.byCategory.map((c) => [c.category, c]));
    expect(by.device.profit).toBe(1000);
    expect(by.accessory.profit).toBe(477);
    expect(by.service.margin).toBe(100);
    expect(res.profit).toBe(1577);
  });

  it("counts the external service-centre cost against a repair", () => {
    const res = computeProfit([], DEV, [{ price: 1800, cost: 400, external_sc_cost: 300 }]);
    const repair = res.byCategory.find((c) => c.category === "repair")!;
    expect(repair.cost).toBe(700);
    expect(repair.profit).toBe(1100);
  });

  it("returns a zero margin instead of dividing by zero", () => {
    const res = computeProfit([], DEV, []);
    expect(res.margin).toBe(0);
    expect(res.profit).toBe(0);
  });

  it("always lists all four categories so the table keeps its shape", () => {
    const res = computeProfit([], DEV, []);
    expect(res.byCategory.map((c) => c.category)).toEqual([
      "device",
      "accessory",
      "service",
      "repair",
    ]);
  });

  it("does not hide a loss behind a floor of zero", () => {
    const res = computeProfit(
      [sale([item({ item_type: "device", item_id: "tecno-8p", total_price: 1000, unit_cost: 600 })])],
      DEV,
      [],
    );
    expect(res.profit).toBe(-550);
    expect(res.margin).toBe(-55);
  });

  describe("discount allocation", () => {
    it("behaves exactly as before when the sale has no discount", () => {
      // Регресія: сьогодні у всіх продажів discount = 0, звіт не має зрушитись.
      const res = computeProfit(
        [
          sale([
            item({ item_type: "device", item_id: "redmi-a5", total_price: 2000, unit_cost: 1000 }),
            item({ item_type: "accessory", total_price: 700, unit_cost: 223 }),
          ]),
        ],
        DEV,
        [],
      );
      expect(res.revenue).toBe(2700);
      expect(res.profit).toBe(1477);
    });

    it("also treats a null discount as no discount", () => {
      const res = computeProfit(
        [sale([item({ total_price: 100, unit_cost: 30 })], null)],
        DEV,
        [],
      );
      expect(res.revenue).toBe(100);
    });

    it("splits a discount across two categories in proportion to their line values", () => {
      // Чек на 1000 (700 техніка + 300 аксесуар) зі знижкою 100.
      const res = computeProfit(
        [
          sale(
            [
              item({ item_type: "device", item_id: "redmi-a5", total_price: 700, unit_cost: 1000 }),
              item({ item_type: "accessory", total_price: 300, unit_cost: 100 }),
            ],
            100,
          ),
        ],
        DEV,
        [],
      );
      const by = Object.fromEntries(res.byCategory.map((c) => [c.category, c]));
      expect(by.device.revenue).toBe(630);
      expect(by.accessory.revenue).toBe(270);
    });

    it("sums byCategory revenue to the top-level revenue for an uneven split", () => {
      const res = computeProfit(
        [
          sale(
            [
              item({ item_type: "device", item_id: "redmi-a5", total_price: 700, unit_cost: 0 }),
              item({ item_type: "accessory", total_price: 300, unit_cost: 0 }),
            ],
            100,
          ),
        ],
        DEV,
        [],
      );
      const byCategorySum = res.byCategory.reduce((s, c) => s + c.revenue, 0);
      expect(byCategorySum).toBe(res.revenue);
      expect(res.revenue).toBe(900);
    });

    it("keeps the categories summing to the total when the split doesn't divide evenly", () => {
      // 3 і 4 не діляться на знижку 1 без остачі — остача йде найбільшій позиції.
      const res = computeProfit(
        [
          sale(
            [
              item({ item_type: "device", item_id: "redmi-a5", total_price: 2, unit_cost: 0 }),
              item({ item_type: "accessory", total_price: 3, unit_cost: 0 }),
              item({ item_type: "service", total_price: 4, unit_cost: 0 }),
            ],
            1,
          ),
        ],
        DEV,
        [],
      );
      const by = Object.fromEntries(res.byCategory.map((c) => [c.category, c]));
      // Пропорційно й округлено: 2, 3, 4 (сума 9, а не 8).
      // Остача -1 йде найбільшій позиції чека — device.
      expect(by.device.revenue).toBe(2);
      expect(by.accessory.revenue).toBe(3);
      expect(by.service.revenue).toBe(3);
      const byCategorySum = res.byCategory.reduce((s, c) => s + c.revenue, 0);
      expect(byCategorySum).toBe(res.revenue);
      expect(res.revenue).toBe(8);
    });

    it("does not change cost, only revenue and therefore margin", () => {
      const noDiscount = computeProfit(
        [sale([item({ item_type: "accessory", total_price: 1000, unit_cost: 400 })])],
        DEV,
        [],
      );
      const withDiscount = computeProfit(
        [sale([item({ item_type: "accessory", total_price: 1000, unit_cost: 400 })], 200)],
        DEV,
        [],
      );
      expect(withDiscount.cost).toBe(noDiscount.cost);
      expect(withDiscount.revenue).toBe(800);
      expect(withDiscount.profit).toBe(400);
      expect(withDiscount.margin).toBe(50);
      expect(noDiscount.margin).toBe(60);
    });

    it("clamps a discount bigger than the line total instead of going negative", () => {
      // Знижка більша за суму чека — помилка каси чи побитий чек. Виторг
      // ніколи не йде в мінус: урізаємо знижку до суми позицій, найгірший
      // випадок — нульовий виторг з чека, а не від'ємний.
      const res = computeProfit(
        [sale([item({ item_type: "accessory", total_price: 300, unit_cost: 100 })], 500)],
        DEV,
        [],
      );
      expect(res.revenue).toBe(0);
      expect(res.profit).toBe(-100);
    });
  });
});

describe("resolveRange", () => {
  const now = new Date("2026-07-22T15:30:00");

  it("starts today at midnight and ends tomorrow at midnight", () => {
    const { start, end } = resolveRange("today", now);
    expect(start.toISOString()).toBe(new Date("2026-07-22T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-23T00:00:00").toISOString());
  });

  it("covers seven whole days including today", () => {
    const { start } = resolveRange("7d", now);
    expect(start.toISOString()).toBe(new Date("2026-07-16T00:00:00").toISOString());
  });

  it("covers thirty whole days including today", () => {
    const { start } = resolveRange("30d", now);
    expect(start.toISOString()).toBe(new Date("2026-06-23T00:00:00").toISOString());
  });

  it("runs the current month from the first", () => {
    const { start, end } = resolveRange("month", now);
    expect(start.toISOString()).toBe(new Date("2026-07-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-08-01T00:00:00").toISOString());
  });

  it("closes the previous month at the first of this one", () => {
    const { start, end } = resolveRange("prev", now);
    expect(start.toISOString()).toBe(new Date("2026-06-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-01T00:00:00").toISOString());
  });

  it("rolls the previous month back across a year boundary", () => {
    const { start, end } = resolveRange("prev", new Date("2026-01-09T12:00:00"));
    expect(start.toISOString()).toBe(new Date("2025-12-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-01-01T00:00:00").toISOString());
  });
});
