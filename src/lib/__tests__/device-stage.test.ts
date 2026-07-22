import { describe, it, expect } from "vitest";
import { deviceStage, type StageDeviceInput, type StageRepairInput } from "../device-stage";

const open: StageRepairInput = { status: "in_progress" };
const closed: StageRepairInput = { status: "completed" };
const cancelled: StageRepairInput = { status: "cancelled" };

function dev(over: Partial<StageDeviceInput> = {}): StageDeviceInput {
  return { status: "in_stock", needs_repair: false, repair_status: "pending", ...over };
}

function codes(d: StageDeviceInput, r: StageRepairInput[] = []) {
  return deviceStage(d, r).discrepancies.map((x) => x.code);
}

describe("deviceStage", () => {
  describe("stage", () => {
    it("puts a device in transit above everything else", () => {
      // Even with an open repair: where the device physically is wins.
      expect(deviceStage(dev({ status: "transit" }), [open]).stage).toBe("transit");
    });

    it("treats sold / returned / archived as archived", () => {
      for (const status of ["sold", "returned", "archived"]) {
        expect(deviceStage(dev({ status }), []).stage).toBe("archived");
      }
    });

    it("does not un-archive a sold device that still has an open repair", () => {
      // The repair being open makes it a problem, not un-sold. It is reported
      // as a discrepancy instead.
      expect(deviceStage(dev({ status: "sold" }), [open]).stage).toBe("archived");
    });

    it("reads an open repair row as in_repair", () => {
      expect(deviceStage(dev(), [open]).stage).toBe("in_repair");
    });

    it("reads the inline repair_status as in_repair too", () => {
      expect(deviceStage(dev({ repair_status: "in_progress" }), []).stage).toBe("in_repair");
      expect(deviceStage(dev({ repair_status: "waiting_parts" }), []).stage).toBe("in_repair");
    });

    it("ignores closed and cancelled repair rows", () => {
      expect(deviceStage(dev(), [closed]).stage).toBe("in_stock");
      expect(deviceStage(dev(), [cancelled]).stage).toBe("in_stock");
    });

    it("flags needs_repair when nothing says the work finished", () => {
      expect(deviceStage(dev({ needs_repair: true }), []).stage).toBe("needs_repair");
    });

    it("does not flag needs_repair once the inline status says done", () => {
      // Stale needs_repair flags outlive the work; repair_status is the
      // completion signal, not the flag.
      expect(
        deviceStage(dev({ needs_repair: true, repair_status: "completed" }), []).stage,
      ).toBe("in_stock");
    });

    it("treats a missing repair_status as not-yet-done rather than done", () => {
      // The equivalent SQL gets this wrong: `repair_status NOT IN (...)` is
      // NULL for a NULL column, which is falsy, so a flagged device would fall
      // through to in_stock.
      expect(
        deviceStage(dev({ needs_repair: true, repair_status: null }), []).stage,
      ).toBe("needs_repair");
    });

    it("falls back to in_stock", () => {
      expect(deviceStage(dev(), []).stage).toBe("in_stock");
    });
  });

  describe("discrepancies", () => {
    it("reports a sale over an open repair", () => {
      expect(codes(dev({ status: "sold" }), [open])).toContain("sold_with_open_repair");
    });

    it("reports stock offered for sale over an open repair", () => {
      expect(codes(dev({ status: "in_stock" }), [open])).toContain("in_stock_with_open_repair");
    });

    it("reports a needs_repair flag with no repair record at all", () => {
      expect(codes(dev({ needs_repair: true }), [])).toContain("repair_not_recorded");
    });

    it("does not report an unrecorded repair when a closed row exists", () => {
      expect(codes(dev({ needs_repair: true }), [closed])).not.toContain("repair_not_recorded");
    });

    it("reports the two models disagreeing", () => {
      expect(codes(dev({ repair_status: "completed" }), [open])).toContain("models_disagree");
    });

    it("stays silent when everything lines up", () => {
      expect(codes(dev(), [closed])).toEqual([]);
      expect(codes(dev({ needs_repair: true, repair_status: "completed" }), [closed])).toEqual([]);
    });

    it("can report more than one problem on the same device", () => {
      // The real shape of two devices in production today.
      const result = codes(dev({ status: "in_stock", repair_status: "completed" }), [open]);
      expect(result).toContain("in_stock_with_open_repair");
      expect(result).toContain("models_disagree");
    });
  });
});
