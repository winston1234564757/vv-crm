import { describe, it, expect } from "vitest";
import {
  hourlyBuckets,
  dayNeighbours,
  previousWorkingDay,
  countOperations,
  type DayOperation,
} from "../day-report";

function op(at: string, amount = 100, kind: "sale" | "repair" = "sale"): DayOperation {
  return { at, amount, kind };
}

describe("hourlyBuckets", () => {
  it("віддає всі 24 години, порожні — нулями", () => {
    const out = hourlyBuckets([op("2026-07-25T14:30:00")]);
    expect(out).toHaveLength(24);
    expect(out[0]).toEqual({ hour: 0, revenue: 0, count: 0 });
    expect(out[14]).toEqual({ hour: 14, revenue: 100, count: 1 });
  });

  it("не з'їдає межі доби", () => {
    const out = hourlyBuckets([op("2026-07-25T00:00:00", 50), op("2026-07-25T23:59:59", 70)]);
    expect(out[0].revenue).toBe(50);
    expect(out[23].revenue).toBe(70);
  });

  it("складає кілька операцій в одну годину", () => {
    const out = hourlyBuckets([op("2026-07-25T12:05:00", 300), op("2026-07-25T12:55:00", 200)]);
    expect(out[12]).toEqual({ hour: 12, revenue: 500, count: 2 });
  });

  it("порожній день — 24 нулі, а не порожній масив", () => {
    const out = hourlyBuckets([]);
    expect(out).toHaveLength(24);
    expect(out.every((b) => b.revenue === 0 && b.count === 0)).toBe(true);
  });
});

describe("dayNeighbours", () => {
  it("віддає сусідні календарні дні", () => {
    expect(dayNeighbours("2026-07-25", "2026-07-21", "2026-07-30")).toEqual({
      prev: "2026-07-24",
      next: "2026-07-26",
    });
  });

  it("упирається в епоху зліва", () => {
    expect(dayNeighbours("2026-07-21", "2026-07-21", "2026-07-30").prev).toBeNull();
  });

  it("упирається в сьогодні справа", () => {
    expect(dayNeighbours("2026-07-30", "2026-07-21", "2026-07-30").next).toBeNull();
  });

  // Порожній день пропускати не можна: це приховало б, що магазин був зачинений.
  it("не перестрибує порожні дні", () => {
    expect(dayNeighbours("2026-07-27", "2026-07-21", "2026-07-30").prev).toBe("2026-07-26");
  });

  it("без епохи ліва межа не ставиться", () => {
    expect(dayNeighbours("2026-07-21", null, "2026-07-30").prev).toBe("2026-07-20");
  });
});

describe("previousWorkingDay", () => {
  const series = [
    { day: "2026-07-24", revenue: 500 },
    { day: "2026-07-25", revenue: 0 },
    { day: "2026-07-26", revenue: 0 },
    { day: "2026-07-27", revenue: 900 },
  ];

  it("пропускає дні без виторгу", () => {
    expect(previousWorkingDay("2026-07-27", series)).toBe("2026-07-24");
  });

  it("повертає null, коли попереднього робочого дня немає", () => {
    expect(previousWorkingDay("2026-07-24", series)).toBeNull();
  });

  it("не бере сам день за базу", () => {
    expect(previousWorkingDay("2026-07-25", series)).toBe("2026-07-24");
  });
});

describe("countOperations", () => {
  // Гарантійна переробка не чек: у виторг додає нуль, а лічильник роздуває.
  it("не рахує ремонт із ціною 0", () => {
    expect(countOperations([{ id: "s1" }], [{ price: 0 }, { price: 1200 }])).toBe(2);
  });

  it("порожній день дає нуль", () => {
    expect(countOperations([], [])).toBe(0);
  });
});
