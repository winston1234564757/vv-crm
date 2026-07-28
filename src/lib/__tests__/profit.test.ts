import { describe, it, expect } from "vitest";
import {
  itemCost,
  computeProfit,
  margin,
  resolveRange,
  previousRange,
  datasetWindowStart,
  chartWindow,
  RANGE_PRESETS,
  sliceProfit,
  sliceExpenses,
  dailySeries,
  comparisonFor,
  deltaPct,
  toDatedRepairs,
  type ProfitSale,
  type ProfitSaleItem,
  type ProfitDeviceCost,
  type ProfitDataset,
  type DatedSale,
  type DatedRepair,
  type DatedExpense,
  type RepairPnlRow,
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

  it("always lists all five categories so the table keeps its shape", () => {
    const res = computeProfit([], DEV, []);
    expect(res.byCategory.map((c) => c.category)).toEqual([
      "device",
      "accessory",
      "part",
      "service",
      "repair",
    ]);
  });

  it("counts a sold spare part's revenue and cost instead of dropping it", () => {
    // Регресія: toCategory() повертав null для "part", і computeProfit
    // пропускав позицію повністю — виторг і собівартість зникали.
    const res = computeProfit(
      [sale([item({ item_type: "part", item_id: "screen-a52", total_price: 500, unit_cost: 180 })])],
      DEV,
      [],
    );
    const part = res.byCategory.find((c) => c.category === "part")!;
    expect(part.revenue).toBe(500);
    expect(part.cost).toBe(180);
    expect(part.profit).toBe(320);
    expect(res.revenue).toBe(500);
    expect(res.cost).toBe(180);
  });

  it("skips an item with an unrecognised item_type instead of crediting it anywhere", () => {
    const res = computeProfit(
      [sale([item({ item_type: "bogus", total_price: 500, unit_cost: 180 })])],
      DEV,
      [],
    );
    expect(res.revenue).toBe(0);
    expect(res.cost).toBe(0);
    expect(res.byCategory.every((c) => c.revenue === 0 && c.cost === 0)).toBe(true);
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

    it("never pushes a category revenue negative when many small lines round up", () => {
      // Регресія: округлення кожної позиції окремо з відкиданням остачі на
      // найбільшу давало device.revenue = -3 тут. Метод найбільших залишків
      // тримає кожну позицію між підлогою і стелею її точної частки.
      const accessories = Array.from({ length: 8 }, () =>
        item({ item_type: "accessory", total_price: 1, unit_cost: 0 }),
      );
      const res = computeProfit(
        [
          sale(
            [...accessories, item({ item_type: "device", item_id: "redmi-a5", total_price: 2, unit_cost: 0 })],
            5,
          ),
        ],
        DEV,
        [],
      );
      expect(res.byCategory.every((c) => c.revenue >= 0)).toBe(true);
      const byCategorySum = res.byCategory.reduce((s, c) => s + c.revenue, 0);
      expect(byCategorySum).toBe(res.revenue);
      expect(res.revenue).toBe(5);
    });

    it("clamps a negative discount to zero instead of inflating revenue", () => {
      // У БД немає CHECK (discount >= 0) — від'ємне значення досяжне.
      const res = computeProfit(
        [sale([item({ item_type: "accessory", total_price: 300, unit_cost: 100 })], -50)],
        DEV,
        [],
      );
      expect(res.revenue).toBe(300);
      expect(res.profit).toBe(200);
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

// ─── Датасет і зрізи ────────────────────────────────────────────────────────

/** Чек із міткою часу. `total_amount` тут декоративний — гроші рахує рушій. */
function dSale(created_at: string, items: ProfitSaleItem[], discount: number | null = 0): DatedSale {
  return { id: created_at, created_at, total_amount: 0, discount, items };
}

function dRepair(settled_at: string, price: number, cost: number): DatedRepair {
  return { settled_at, price, cost, external_sc_cost: 0 };
}

function dExpense(
  created_at: string,
  amount: number,
  over: Partial<DatedExpense> = {},
): DatedExpense {
  return { created_at, amount, category_id: null, paid_from_safe_id: null, ...over };
}

function dataset(over: Partial<ProfitDataset> = {}): ProfitDataset {
  return {
    sales: [],
    repairs: [],
    expenses: [],
    devices: DEV,
    windowStart: new Date("2026-01-01T00:00:00"),
    ...over,
  };
}

describe("sliceProfit", () => {
  const ds = dataset({
    sales: [
      dSale("2026-07-20T10:00:00", [item({ total_price: 100, unit_cost: 30 })]),
      dSale("2026-07-21T10:00:00", [item({ total_price: 200, unit_cost: 50 })]),
      dSale("2026-07-22T10:00:00", [item({ total_price: 400, unit_cost: 90 })]),
    ],
    repairs: [dRepair("2026-07-21T15:00:00", 500, 120)],
  });

  it("takes the window half-open: start included, end excluded", () => {
    const r = sliceProfit(ds, new Date("2026-07-21T00:00:00"), new Date("2026-07-22T00:00:00"));
    // Лише чек 21-го (200) плюс ремонт 21-го (500). 22-ге вже за межею.
    expect(r.revenue).toBe(700);
    expect(r.cost).toBe(170);
  });

  it("returns zeros for an inverted window instead of hitting the data", () => {
    const r = sliceProfit(ds, new Date("2026-07-22T00:00:00"), new Date("2026-07-20T00:00:00"));
    expect(r.revenue).toBe(0);
    expect(r.profit).toBe(0);
  });

  it("routes a device through the same cost_price + repair_cost rule", () => {
    const one = dataset({
      sales: [
        dSale("2026-07-20T10:00:00", [
          item({ item_type: "device", item_id: "tecno-8p", total_price: 2000, unit_cost: 600 }),
        ]),
      ],
    });
    const r = sliceProfit(one, new Date("2026-07-20T00:00:00"), new Date("2026-07-21T00:00:00"));
    expect(r.cost).toBe(1550);
    expect(r.profit).toBe(450);
  });
});

describe("sliceExpenses", () => {
  const ds = dataset({
    expenses: [
      dExpense("2026-07-20T10:00:00", 300),
      dExpense("2026-07-20T11:00:00", 5000, { category_id: "capital" }),
      dExpense("2026-07-20T12:00:00", 900, { paid_from_safe_id: "np-safe" }),
      dExpense("2026-07-25T10:00:00", 400),
    ],
  });
  const from = new Date("2026-07-20T00:00:00");
  const to = new Date("2026-07-21T00:00:00");

  it("drops capital spend and owner withdrawals", () => {
    expect(sliceExpenses(ds, from, to, "capital", "np-safe")).toBe(300);
  });

  it("keeps uncategorised spend when no capital category is configured", () => {
    // Регресія: `e.category_id !== capitalCategoryId` при обох null відсікало
    // витрату без категорії — вона тихо зникала з P&L.
    const noCategory = dataset({ expenses: [dExpense("2026-07-20T10:00:00", 300)] });
    expect(sliceExpenses(noCategory, from, to, null, null)).toBe(300);
  });
});

describe("dailySeries", () => {
  const ds = dataset({
    sales: [
      dSale("2026-07-20T10:00:00", [item({ total_price: 100, unit_cost: 30 })]),
      dSale("2026-07-22T10:00:00", [item({ total_price: 400, unit_cost: 90 })]),
    ],
    repairs: [dRepair("2026-07-22T15:00:00", 500, 120)],
    expenses: [dExpense("2026-07-21T10:00:00", 250)],
  });
  const opts = { capitalCategoryId: null, netProfitSafeId: null };
  const from = new Date("2026-07-20T00:00:00");
  const to = new Date("2026-07-23T00:00:00");

  it("emits a point for every calendar day, including the empty one", () => {
    const s = dailySeries(ds, from, to, opts);
    expect(s.map((p) => p.day)).toEqual(["2026-07-20", "2026-07-21", "2026-07-22"]);
  });

  it("reports a day with no sales as zero revenue, not as a gap", () => {
    const s = dailySeries(ds, from, to, opts);
    expect(s[1]).toMatchObject({ day: "2026-07-21", revenue: 0, profit: 0, expenses: 250, net: -250 });
  });

  it("sums to exactly what sliceProfit reports for the same window", () => {
    // Головний інваріант: графік не має права розійтися з KPI над ним.
    const s = dailySeries(ds, from, to, opts);
    const whole = sliceProfit(ds, from, to);
    expect(s.reduce((n, p) => n + p.revenue, 0)).toBe(whole.revenue);
    expect(s.reduce((n, p) => n + p.cost, 0)).toBe(whole.cost);
    expect(s.reduce((n, p) => n + p.profit, 0)).toBe(whole.profit);
  });

  it("returns nothing for an inverted window", () => {
    expect(dailySeries(ds, to, from, opts)).toEqual([]);
  });
});

describe("previousRange", () => {
  const now = new Date("2026-07-21T14:30:00");

  it("baselines today against the seven days before it, not yesterday alone", () => {
    const { start, end } = previousRange("today", now);
    expect(start.toISOString()).toBe(new Date("2026-07-14T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-21T00:00:00").toISOString());
  });

  it("puts the 7d window against the seven days before it", () => {
    const { start, end } = previousRange("7d", now);
    expect(start.toISOString()).toBe(new Date("2026-07-08T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-15T00:00:00").toISOString());
  });

  it("compares month-to-date against the same day count last month", () => {
    const { start, end } = previousRange("month", now);
    expect(start.toISOString()).toBe(new Date("2026-06-01T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-06-22T00:00:00").toISOString());
  });

  it("clamps to the end of a shorter previous month", () => {
    // 31 березня: лютий 2026 має 28 днів, вікно не має заповзати в березень.
    const { end } = previousRange("month", new Date("2026-03-31T12:00:00"));
    expect(end.toISOString()).toBe(new Date("2026-03-01T00:00:00").toISOString());
  });
});

describe("datasetWindowStart", () => {
  it("reaches back far enough to cover the prev-month baseline", () => {
    // Найгірший випадок: 31 січня, пресет `prev` порівнюється з листопадом.
    const now = new Date("2026-01-31T18:00:00");
    const start = datasetWindowStart("prev", now);
    expect(start.getTime()).toBeLessThanOrEqual(previousRange("prev", now).start.getTime());
  });

  it("stops at the earliest window actually needed, not a round number", () => {
    // 21 липня, пресет «сьогодні»: найдальше сягає початок місяця (1 липня),
    // бо `monthProfit` рахується завжди. Графіку тут треба лише два тижні,
    // тож вибірка більше не тягне зайвий місяць «про запас».
    const now = new Date("2026-07-21T14:30:00");
    expect(datasetWindowStart("today", now).toISOString()).toBe(
      new Date("2026-07-01T00:00:00").toISOString(),
    );
  });
});

describe("chartWindow", () => {
  const now = new Date("2026-07-21T14:30:00");

  it("gives today two weeks of context instead of a single point", () => {
    const { start, end } = chartWindow("today", now);
    expect(start.toISOString()).toBe(new Date("2026-07-08T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-22T00:00:00").toISOString());
  });

  it("follows the selected period for every other preset", () => {
    // Регресія: графік показував незмінні останні 30 днів, тож перемикання
    // «Цей місяць» / «Минулий місяць» на нього не впливало взагалі.
    for (const preset of ["7d", "30d", "month", "prev"] as const) {
      expect(chartWindow(preset, now)).toEqual(resolveRange(preset, now));
    }
  });

  it("ends a picked day's window on that day, not on today", () => {
    const { start, end } = chartWindow("today", now, "2026-07-15");
    expect(start.toISOString()).toBe(new Date("2026-07-02T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-16T00:00:00").toISOString());
  });

  it("stays inside the fetched dataset for every preset", () => {
    for (const preset of RANGE_PRESETS) {
      expect(datasetWindowStart(preset, now).getTime()).toBeLessThanOrEqual(
        chartWindow(preset, now).start.getTime(),
      );
    }
  });
});

describe("comparisonFor", () => {
  const now = new Date("2026-07-21T14:30:00");
  /** Сім рівних днів по 100 ₴ виторгу перед 21-м. */
  const week = dataset({
    sales: Array.from({ length: 7 }, (_, i) =>
      dSale(`2026-07-${String(14 + i).padStart(2, "0")}T10:00:00`, [
        item({ total_price: 100, unit_cost: 40 }),
      ]),
    ),
  });

  it("averages the baseline days for today", () => {
    const c = comparisonFor(week, "today", now, null);
    expect(c).toMatchObject({ revenue: 100, profit: 60, label: "до середнього дня" });
  });

  it("stays silent when there is under three days of history", () => {
    const thin = dataset({
      sales: [dSale("2026-07-20T10:00:00", [item({ total_price: 100 })])],
    });
    // Епоха 19-го лишає в базі два дні — замало, щоб середнє щось означало.
    expect(comparisonFor(thin, "today", now, "2026-07-19T00:00:00")).toBeNull();
  });

  it("stays silent when the baseline window is entirely before the epoch", () => {
    expect(comparisonFor(week, "today", now, "2026-07-21T00:00:00")).toBeNull();
  });

  it("stays silent on a zero-revenue baseline instead of inventing growth", () => {
    expect(comparisonFor(dataset(), "7d", now, null)).toBeNull();
  });
});

describe("deltaPct", () => {
  it("reads a rise off the baseline", () => {
    expect(deltaPct(118, 100)).toBe(18);
  });

  it("has no answer against a zero baseline", () => {
    expect(deltaPct(500, 0)).toBeNull();
  });

  it("uses the baseline magnitude so a loss shrinking reads as growth", () => {
    // База −200, стало −100: це рух угору на 50%, а не вниз.
    expect(deltaPct(-100, -200)).toBe(50);
  });
});

// `toDatedRepairs` — єдина брама між базою і P&L. SQL-фільтр по датах грубий
// (тягне обидві дати закриття), тож точність вікна тримається саме тут.
describe("toDatedRepairs", () => {
  const start = new Date("2026-07-28T00:00:00Z");
  const end = new Date("2026-07-29T00:00:00Z");

  const row = (over: Partial<RepairPnlRow> = {}): RepairPnlRow => ({
    price: 1800,
    cost: 950,
    external_sc_cost: 0,
    status: "received",
    payment_status: "paid",
    paid_at: "2026-07-28T07:13:37Z",
    completed_at: null,
    ...over,
  });

  it("бере передоплачений ремонт, який ще навіть не в роботі", () => {
    const out = toDatedRepairs([row()], start, end);
    expect(out).toHaveLength(1);
    expect(out[0].settled_at).toBe("2026-07-28T07:13:37Z");
    expect(out[0].price).toBe(1800);
    expect(out[0].cost).toBe(950);
  });

  // Рядок пройшов грубий SQL-фільтр по `completed_at`, але заплатили за нього
  // раніше — у це вікно він не належить.
  it("відкидає оплачений до вікна, хоч і виданий усередині", () => {
    const out = toDatedRepairs(
      [
        row({
          paid_at: "2026-07-20T10:00:00Z",
          completed_at: "2026-07-28T12:00:00Z",
          status: "handed_over",
        }),
      ],
      start,
      end,
    );
    expect(out).toEqual([]);
  });

  it("відкидає незакриті ремонти", () => {
    const out = toDatedRepairs(
      [row({ payment_status: "unpaid", paid_at: null })],
      start,
      end,
    );
    expect(out).toEqual([]);
  });

  it("проводить гарантійну переробку з її собівартістю", () => {
    const out = toDatedRepairs(
      [
        row({
          price: 0,
          cost: 400,
          payment_status: "unpaid",
          paid_at: null,
          status: "handed_over",
          completed_at: "2026-07-28T15:00:00Z",
        }),
      ],
      start,
      end,
    );
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(0);
    expect(out[0].cost).toBe(400);
  });
});
