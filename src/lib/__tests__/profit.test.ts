import { describe, it, expect } from "vitest";
import {
  itemCost,
  computeProfit,
  resolveRange,
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
});

describe("computeProfit", () => {
  it("reports the real margin on the Tecno 8P, not the inflated one", () => {
    // Купівля 600 + ремонт 950, продаж 2000. Зламаний unit_cost дав би 70%.
    const res = computeProfit(
      [item({ item_type: "device", item_id: "tecno-8p", total_price: 2000, unit_cost: 600 })],
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
        item({ item_type: "device", item_id: "redmi-a5", total_price: 2000, unit_cost: 1000 }),
        item({ item_type: "accessory", total_price: 700, unit_cost: 223 }),
        item({ item_type: "service", total_price: 100, unit_cost: 0 }),
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
      [item({ item_type: "device", item_id: "tecno-8p", total_price: 1000, unit_cost: 600 })],
      DEV,
      [],
    );
    expect(res.profit).toBe(-550);
    expect(res.margin).toBe(-55);
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
