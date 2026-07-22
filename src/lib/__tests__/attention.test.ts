import { describe, it, expect } from "vitest";
import {
  statusSince,
  daysBetween,
  findAttention,
  type AttentionRepair,
  type AttentionStockItem,
} from "../attention";

const NOW = new Date("2026-07-22T12:00:00Z");

function repair(over: Partial<AttentionRepair> = {}): AttentionRepair {
  return {
    id: "r1",
    device_name: "Tecno 8P",
    status: "in_progress",
    created_at: "2026-06-26T10:00:00Z",
    inventory_device_id: null,
    payment_status: "unpaid",
    last_log_at: null,
    ...over,
  };
}

function stock(over: Partial<AttentionStockItem> = {}): AttentionStockItem {
  return { id: "a1", name: "Кабель", stock: 2, min_stock: 2, kind: "accessory", ...over };
}

describe("statusSince", () => {
  it("falls back to created_at when the repair never moved", () => {
    // Лог пише лише переходи, тому нерухомі ремонти в ньому відсутні —
    // а це рівно ті, що нас цікавлять.
    expect(statusSince(repair({ last_log_at: null }))).toBe("2026-06-26T10:00:00Z");
  });

  it("uses the last logged transition when there is one", () => {
    expect(statusSince(repair({ last_log_at: "2026-07-20T09:00:00Z" }))).toBe(
      "2026-07-20T09:00:00Z",
    );
  });

  it("ignores updated_at entirely", () => {
    // updated_at зіпсований груповими операціями: усі три застряглі ремонти
    // показують 3 дні при віці 23-26 днів.
    const r = repair() as AttentionRepair & { updated_at?: string };
    r.updated_at = "2026-07-19T00:00:00Z";
    expect(statusSince(r)).toBe("2026-06-26T10:00:00Z");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-07-15T12:00:00Z", NOW)).toBe(7);
  });
  it("returns zero for the future rather than a negative", () => {
    expect(daysBetween("2026-08-01T00:00:00Z", NOW)).toBe(0);
  });
});

describe("findAttention", () => {
  it("flags a repair that has not moved in over two weeks", () => {
    const groups = findAttention({ repairs: [repair()], stock: [] }, NOW);
    const stalled = groups.find((g) => g.code === "repair_stalled")!;
    expect(stalled.total).toBe(1);
    expect(stalled.rows[0].title).toBe("Tecno 8P");
    expect(stalled.rows[0].note).toBe("26 днів без руху");
  });

  it("leaves a fresh repair alone", () => {
    const groups = findAttention(
      { repairs: [repair({ created_at: "2026-07-20T10:00:00Z" })], stock: [] },
      NOW,
    );
    expect(groups.find((g) => g.code === "repair_stalled")).toBeUndefined();
  });

  it("does not flag a closed repair as stalled", () => {
    const groups = findAttention({ repairs: [repair({ status: "completed" })], stock: [] }, NOW);
    expect(groups.find((g) => g.code === "repair_stalled")).toBeUndefined();
  });

  it("never calls a warehouse repair unpaid", () => {
    // Внутрішній ремонт не має платника; payment_status у нього NULL.
    const groups = findAttention(
      {
        repairs: [
          repair({ status: "handed_over", inventory_device_id: "d1", payment_status: null }),
        ],
        stock: [],
      },
      NOW,
    );
    expect(groups.find((g) => g.code === "repair_unpaid")).toBeUndefined();
  });

  it("flags a handed-over customer repair that was never paid", () => {
    const groups = findAttention(
      { repairs: [repair({ status: "handed_over", payment_status: "unpaid" })], stock: [] },
      NOW,
    );
    expect(groups.find((g) => g.code === "repair_unpaid")!.total).toBe(1);
  });

  it("puts a zero stock above a merely low one", () => {
    const groups = findAttention(
      {
        repairs: [],
        stock: [stock({ id: "a", name: "Кабель", stock: 2 }), stock({ id: "b", name: "МЗП", stock: 0 })],
      },
      NOW,
    );
    const low = groups.find((g) => g.code === "stock_low")!;
    expect(low.rows[0].title).toBe("МЗП");
    expect(low.total).toBe(2);
  });

  it("shows only the top three rows but counts them all", () => {
    // 32 рядки списком нечитабельні: число + топ, решта за кліком.
    const many = Array.from({ length: 32 }, (_, i) =>
      stock({ id: `a${i}`, name: `Товар ${i}`, stock: 2 }),
    );
    const low = findAttention({ repairs: [], stock: many }, NOW).find(
      (g) => g.code === "stock_low",
    )!;
    expect(low.rows).toHaveLength(3);
    expect(low.total).toBe(32);
  });

  it("ignores stock that is comfortably above its minimum", () => {
    const groups = findAttention(
      { repairs: [], stock: [stock({ stock: 5, min_stock: 2 })] },
      NOW,
    );
    expect(groups.find((g) => g.code === "stock_low")).toBeUndefined();
  });

  it("returns no empty groups at all", () => {
    // Порожній стан — відсутність блоку, а не картка «все добре».
    expect(findAttention({ repairs: [], stock: [] }, NOW)).toEqual([]);
  });
});
