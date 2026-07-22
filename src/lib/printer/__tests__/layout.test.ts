import { describe, it, expect } from "vitest";
import {
  DEFAULT_WIDTH,
  alignCenter,
  alignRight,
  divider,
  itemLines,
  labelValue,
  money,
  wrap,
} from "../layout";
import { encode } from "../codec";

/** Nothing may exceed the printable line, whatever the input. */
function expectFits(lines: string[], width = DEFAULT_WIDTH) {
  for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
}

describe("receipt layout", () => {
  it("uses the printer's real line width", () => {
    expect(DEFAULT_WIDTH).toBe(32);
  });

  describe("wrap", () => {
    it("breaks on spaces without exceeding the width", () => {
      const lines = wrap("Пристрій приймається без гарантії на інші несправності.");
      expectFits(lines);
      expect(lines.join(" ")).toBe(
        "Пристрій приймається без гарантії на інші несправності.",
      );
    });

    it("hard-splits a word longer than the line instead of overflowing", () => {
      // A 15-digit IMEI fits, but a run-on serial must not reach the paper edge
      // and vanish — the receipt is the record of which device was taken in.
      const lines = wrap("X".repeat(70));
      expectFits(lines);
      expect(lines.join("")).toBe("X".repeat(70));
    });

    it("keeps a long word intact across the split", () => {
      const lines = wrap("IMEI 864244060473394827364758392017");
      expectFits(lines);
      expect(lines.join("").replace(/ /g, "")).toContain("864244060473394827364758392017");
    });

    it("preserves explicit line breaks", () => {
      expect(wrap("а\nб")).toEqual(["а", "б"]);
    });

    it("collapses runs of spaces rather than emitting stray blanks", () => {
      expect(wrap("а    б")).toEqual(["а б"]);
    });

    it("returns a single blank line for empty input", () => {
      expect(wrap("")).toEqual([""]);
    });

    it("normalises before measuring, so ₴ is counted as three columns", () => {
      // "12345678901234567890123456789 ₴" is 31 characters but 33 printed.
      const lines = wrap("12345678901234567890123456789 ₴");
      expectFits(lines);
      expect(lines.join(" ")).toBe("12345678901234567890123456789 грн");
    });
  });

  describe("labelValue", () => {
    it("pads the pair out to exactly the full width", () => {
      const [line] = labelValue("Разом:", "1 500 грн");
      expect(line).toHaveLength(DEFAULT_WIDTH);
      expect(line.startsWith("Разом:")).toBe(true);
      expect(line.endsWith("1 500 грн")).toBe(true);
    });

    it("moves the value to its own right-aligned line when the pair will not fit", () => {
      const lines = labelValue("Заявлена несправність пристрою", "не заряджається");
      expectFits(lines);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[lines.length - 1].endsWith("не заряджається")).toBe(true);
    });

    it("never truncates the value", () => {
      const lines = labelValue("Дуже довга назва позиції у чеку", "999 999 грн");
      expect(lines.join("")).toContain("999 999 грн");
    });
  });

  describe("alignment", () => {
    it("right-aligns to the width", () => {
      expect(alignRight("сума")).toHaveLength(DEFAULT_WIDTH);
      expect(alignRight("сума").endsWith("сума")).toBe(true);
    });

    it("centres with the odd column leaning left", () => {
      // 32 - 5 = 27; 13 leading spaces, so the text sits one column left of true
      // centre rather than leaving a ragged right edge.
      expect(alignCenter("АБВГД")).toBe(" ".repeat(13) + "АБВГД");
    });

    it("leaves over-long text alone rather than padding it negatively", () => {
      const long = "X".repeat(40);
      expect(alignRight(long)).toBe(long);
      expect(alignCenter(long)).toBe(long);
    });
  });

  it("draws a full-width divider", () => {
    expect(divider()).toBe("-".repeat(32));
    expect(divider(32, "=")).toBe("=".repeat(32));
  });

  describe("money", () => {
    it("groups thousands with a plain space", () => {
      expect(money(1500)).toBe("1 500");
      expect(money(1234567)).toBe("1 234 567");
      expect(money(999)).toBe("999");
      expect(money(1000)).toBe("1 000");
    });

    it("leaves values under a thousand ungrouped", () => {
      expect(money(0)).toBe("0");
      expect(money(450)).toBe("450");
    });

    it("rounds rather than emitting fractional kopecks", () => {
      expect(money(450.4)).toBe("450");
      expect(money(450.6)).toBe("451");
    });

    it("handles negatives", () => {
      expect(money(-1500)).toBe("-1 500");
    });

    it("uses a separator the code page can actually print", () => {
      // toLocaleString would emit U+00A0 here, which is not in every Cyrillic
      // page and would silently become '?' on paper.
      expect(encode(money(1234567), "cp1251")).not.toContain(0x3f);
    });
  });

  describe("itemLines", () => {
    it("gives the name the full width and the arithmetic its own line", () => {
      const lines = itemLines("Realme 9 RMX3521", 2, 4500, 9000);
      expectFits(lines);
      expect(lines[0]).toBe("Realme 9 RMX3521");
      expect(lines[lines.length - 1].trim()).toBe("2 x 4 500 = 9 000");
    });

    it("wraps a long product name across lines without losing any of it", () => {
      const name = "Захисне скло для Samsung Galaxy A54 5G повноекранне чорне";
      const lines = itemLines(name, 1, 150, 150);
      expectFits(lines);
      expect(lines.slice(0, -1).join(" ")).toBe(name);
    });

    it("right-aligns the arithmetic line to the paper edge", () => {
      const lines = itemLines("Товар", 1, 100, 100);
      const math = lines[lines.length - 1];
      expect(math).toHaveLength(DEFAULT_WIDTH);
      expect(math.endsWith("1 x 100 = 100")).toBe(true);
    });
  });
});
