import { describe, it, expect } from "vitest";
import { encode, canEncode, normalizeForPrinter, CODEPAGES } from "../codec";

/** Every letter the receipts can contain, both cases. */
const UKRAINIAN_ALPHABET =
  "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ" + "абвгґдеєжзиіїйклмнопрстуфхцчшщьюя";

/** The eight letters that separate a Ukrainian page from a Russian one. */
const UKRAINIAN_ONLY = "іІїЇєЄґҐ";

function bytes(text: string, page: Parameters<typeof encode>[1]): number[] {
  return Array.from(encode(text, page));
}

describe("printer codec", () => {
  describe("CP1251", () => {
    it("maps the Ukrainian-only letters to their documented byte positions", () => {
      // Straight off the CP1251 chart — the whole point of choosing this page.
      expect(bytes("І", "cp1251")).toEqual([0xb2]);
      expect(bytes("і", "cp1251")).toEqual([0xb3]);
      expect(bytes("Ї", "cp1251")).toEqual([0xaf]);
      expect(bytes("ї", "cp1251")).toEqual([0xbf]);
      expect(bytes("Є", "cp1251")).toEqual([0xaa]);
      expect(bytes("є", "cp1251")).toEqual([0xba]);
      expect(bytes("Ґ", "cp1251")).toEqual([0xa5]);
      expect(bytes("ґ", "cp1251")).toEqual([0xb4]);
    });

    it("places the contiguous Cyrillic run at 0xC0..0xFF", () => {
      expect(bytes("А", "cp1251")).toEqual([0xc0]);
      expect(bytes("Я", "cp1251")).toEqual([0xdf]);
      expect(bytes("а", "cp1251")).toEqual([0xe0]);
      expect(bytes("я", "cp1251")).toEqual([0xff]);
    });

    it("covers the whole Ukrainian alphabet", () => {
      expect(canEncode(UKRAINIAN_ALPHABET, "cp1251")).toBe(true);
      expect(encode(UKRAINIAN_ALPHABET, "cp1251")).not.toContain(0x3f);
    });
  });

  describe("CP866 vs CP1125", () => {
    it("CP866 cannot represent і/І — the reason it is not usable for Ukrainian", () => {
      expect(canEncode("і", "cp866")).toBe(false);
      expect(canEncode("І", "cp866")).toBe(false);
      // Falls back to '?' rather than throwing.
      expect(bytes("і", "cp866")).toEqual([0x3f]);
    });

    it("CP1125 replaces the CP866 tail with the Ukrainian letters", () => {
      expect(bytes("Ґ", "cp1125")).toEqual([0xf0]);
      expect(bytes("ґ", "cp1125")).toEqual([0xf1]);
      expect(bytes("Є", "cp1125")).toEqual([0xf2]);
      expect(bytes("є", "cp1125")).toEqual([0xf3]);
      expect(bytes("Ї", "cp1125")).toEqual([0xf4]);
      expect(bytes("ї", "cp1125")).toEqual([0xf5]);
      expect(bytes("І", "cp1125")).toEqual([0xf6]);
      expect(bytes("і", "cp1125")).toEqual([0xf7]);
    });

    it("CP866 puts Ё ё Є є Ї ї Ў ў where CP1125 puts the Ukrainian set", () => {
      expect(bytes("Ё", "cp866")).toEqual([0xf0]);
      expect(bytes("Ў", "cp866")).toEqual([0xf6]);
      // Same byte, different glyph — which is exactly how the printed probe
      // tells a CP866 firmware apart from a CP1125 one.
      expect(bytes("І", "cp1125")).toEqual(bytes("Ў", "cp866"));
    });

    it("shares the base Cyrillic run between the two DOS pages", () => {
      expect(bytes("А", "cp866")).toEqual([0x80]);
      expect(bytes("А", "cp1125")).toEqual([0x80]);
      expect(bytes("я", "cp866")).toEqual([0xef]);
      expect(bytes("я", "cp1125")).toEqual([0xef]);
    });

    it("CP1125 covers the whole Ukrainian alphabet, CP866 does not", () => {
      expect(canEncode(UKRAINIAN_ALPHABET, "cp1125")).toBe(true);
      expect(canEncode(UKRAINIAN_ALPHABET, "cp866")).toBe(false);
      expect(canEncode(UKRAINIAN_ONLY, "cp1125")).toBe(true);
    });
  });

  describe("normalisation", () => {
    it("expands ₴, which no 8-bit Cyrillic page carries", () => {
      expect(normalizeForPrinter("450 ₴")).toBe("450 грн");
    });

    it("folds typographic punctuation to ASCII", () => {
      expect(normalizeForPrinter("«Ремонт» — це")).toBe('"Ремонт" - це');
      expect(normalizeForPrinter("він’с")).toBe("він'с");
      expect(normalizeForPrinter("чекайте…")).toBe("чекайте...");
      expect(normalizeForPrinter("a b")).toBe("a b");
    });

    it("is idempotent, so applying it twice cannot corrupt the layout", () => {
      const once = normalizeForPrinter("450 ₴ — «тест»…");
      expect(normalizeForPrinter(once)).toBe(once);
    });

    it("runs before encoding, so ₴ never reaches the byte stage", () => {
      expect(bytes("₴", "cp1251")).toEqual(bytes("грн", "cp1251"));
      expect(encode("₴", "cp1251")).not.toContain(0x3f);
    });
  });

  describe("robustness", () => {
    it("never throws and never returns an empty byte for unknown characters", () => {
      for (const page of CODEPAGES) {
        // CJK has no place in any Cyrillic page.
        expect(bytes("漢", page)).toEqual([0x3f]);
        expect(() => encode("🙂", page)).not.toThrow();
      }
    });

    it("passes ASCII and newlines straight through", () => {
      expect(bytes("A1 z\n", "cp1251")).toEqual([0x41, 0x31, 0x20, 0x7a, 0x0a]);
    });

    it("returns one byte per character, so column arithmetic holds", () => {
      const text = "Квитанція приймання";
      for (const page of CODEPAGES) {
        expect(encode(text, page).length).toBe(text.length);
      }
    });
  });
});
