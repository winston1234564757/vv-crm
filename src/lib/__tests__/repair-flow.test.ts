import { describe, it, expect } from "vitest";
import {
  repairGroup,
  isTerminal,
  nextStep,
  isUnpaid,
  outstanding,
  repairSettledAt,
  REPAIR_GROUP_ORDER,
  type RepairStatus,
} from "../repair-flow";

const ALL_STATUSES: RepairStatus[] = [
  "received",
  "diagnostics",
  "in_progress",
  "awaiting_parts",
  "ready",
  "handed_over",
  "cancelled",
];

describe("repairGroup", () => {
  it("puts every status in exactly one group", () => {
    for (const s of ALL_STATUSES) {
      expect(REPAIR_GROUP_ORDER).toContain(repairGroup(s));
    }
  });

  it("groups the four working statuses as active", () => {
    expect(repairGroup("received")).toBe("active");
    expect(repairGroup("diagnostics")).toBe("active");
    expect(repairGroup("in_progress")).toBe("active");
    expect(repairGroup("awaiting_parts")).toBe("active");
  });

  it("keeps ready as the pickup queue — fixed, not yet collected", () => {
    expect(repairGroup("ready")).toBe("ready");
  });

  it("groups handed_over as done", () => {
    expect(repairGroup("handed_over")).toBe("done");
  });

  it("treats the retired completed as done, not as work in progress", () => {
    // Живих рядків із ним не лишилось, але дефолт «active» затягнув би будь-який
    // недомігрований рядок назад у роботу — а він давно закритий.
    expect(repairGroup("completed")).toBe("done");
    expect(isTerminal("completed")).toBe(true);
  });

  it("falls back to active for an unknown status rather than hiding it", () => {
    expect(repairGroup("nonsense")).toBe("active");
  });
});

describe("isTerminal", () => {
  it("is true only for done and cancelled", () => {
    expect(isTerminal("handed_over")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("ready")).toBe(false);
    expect(isTerminal("in_progress")).toBe(false);
  });
});

describe("nextStep", () => {
  it("walks the happy path to handover", () => {
    expect(nextStep("received")?.target).toBe("diagnostics");
    expect(nextStep("diagnostics")?.target).toBe("in_progress");
    expect(nextStep("in_progress")?.target).toBe("ready");
    // Готовий → Видано напряму: проміжного кроку між ними більше немає.
    expect(nextStep("ready")?.target).toBe("handed_over");
  });

  it("returns a repair waiting on parts to work, not to diagnostics", () => {
    expect(nextStep("awaiting_parts")?.target).toBe("in_progress");
  });

  it("offers nothing once the repair is over", () => {
    expect(nextStep("handed_over")).toBeNull();
    expect(nextStep("cancelled")).toBeNull();
  });

  it("never proposes a step that leaves the known vocabulary", () => {
    for (const s of ALL_STATUSES) {
      const step = nextStep(s);
      if (step) expect(ALL_STATUSES).toContain(step.target);
    }
  });
});

describe("isUnpaid", () => {
  it("is true for an unpaid priced repair", () => {
    expect(isUnpaid({ price: 1800, payment_status: "unpaid" })).toBe(true);
  });

  it("is true for a partially paid repair", () => {
    expect(isUnpaid({ price: 1800, payment_status: "partial" })).toBe(true);
  });

  it("is false once paid", () => {
    expect(isUnpaid({ price: 1800, payment_status: "paid" })).toBe(false);
  });

  it("is false for a warranty repair regardless of status", () => {
    // Warranty work is free; billing it would be wrong, and listing it as
    // debt would put permanent noise in the segment.
    expect(isUnpaid({ price: 1800, payment_status: "unpaid", is_warranty: true })).toBe(false);
  });

  it("is false when there is nothing to collect", () => {
    expect(isUnpaid({ price: 0, payment_status: "unpaid" })).toBe(false);
  });

  it("is true for a null payment_status — treated as debt, not silently dropped", () => {
    expect(isUnpaid({ price: 500, payment_status: null })).toBe(true);
  });
});

describe("outstanding", () => {
  it("is the full price when nothing was paid", () => {
    expect(outstanding({ price: 1800, payment_status: "unpaid" })).toBe(1800);
  });

  it("subtracts what the ledger already holds", () => {
    expect(outstanding({ price: 1800, payment_status: "partial" }, 500)).toBe(1300);
  });

  it("never goes negative on an overpayment", () => {
    expect(outstanding({ price: 1800, payment_status: "partial" }, 2000)).toBe(0);
  });

  it("is zero for anything not owed", () => {
    expect(outstanding({ price: 1800, payment_status: "paid" }, 1800)).toBe(0);
    expect(outstanding({ price: 1800, payment_status: "unpaid", is_warranty: true })).toBe(0);
  });
});

// Правило визнання виторгу: ремонт заробляється видачею клієнту. Ціна й статус
// оплати на це не впливають — ні передоплата не робить ремонт закритим, ні борг
// не заважає йому закритись.
describe("repairSettledAt", () => {
  const base = {
    completed_at: null as string | null,
    status: "received",
  };

  it("закриває ремонт датою видачі", () => {
    expect(
      repairSettledAt({ status: "handed_over", completed_at: "2026-07-27T12:00:00Z" }),
    ).toBe("2026-07-27T12:00:00Z");
  });

  // Гроші вже в касі й видно їх у «Гроші в наявності», але заробленими вони
  // стають, коли пристрій пішов. Інакше виторг і рядок на сторінці Продажів
  // лежали б у різних днях.
  it("не закриває передоплачений, поки його не видали", () => {
    expect(repairSettledAt({ ...base, status: "in_progress" })).toBeNull();
  });

  // Дзеркало попереднього: виторг є, каси за ним нема. Борг окремо показує
  // рядок «у борг» у розбивці дня.
  it("закриває виданий у борг", () => {
    expect(
      repairSettledAt({ status: "handed_over", completed_at: "2026-07-27T12:00:00Z" }),
    ).toBe("2026-07-27T12:00:00Z");
  });

  // Без цієї гілки собівартість гарантійної переробки зникла б із P&L.
  it("закриває роботу без рахунку датою видачі", () => {
    expect(
      repairSettledAt({ status: "handed_over", completed_at: "2026-07-27T12:00:00Z" }),
    ).toBe("2026-07-27T12:00:00Z");
  });

  it("архівний completed рахується виданим", () => {
    expect(
      repairSettledAt({ status: "completed", completed_at: "2026-07-20T10:00:00Z" }),
    ).toBe("2026-07-20T10:00:00Z");
  });

  // Дата — єдине свідчення, що видача була. Статус без неї не рахуємо.
  it("не закриває handed_over без дати видачі", () => {
    expect(repairSettledAt({ ...base, status: "handed_over" })).toBeNull();
  });

  it("не закриває скасований", () => {
    expect(
      repairSettledAt({ status: "cancelled", completed_at: "2026-07-27T12:00:00Z" }),
    ).toBeNull();
  });
});
