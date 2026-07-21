import { describe, it, expect } from "vitest";
import {
  align,
  bold,
  cancelKanjiMode,
  concat,
  cut,
  feed,
  init,
  selectKanjiMode,
  line,
  qr,
  raster,
  Receipt,
  selectCodepage,
  size,
  text,
  COLUMNS_FONT_A,
  DOTS_PER_LINE,
} from "../escpos";

const ESC = 0x1b;
const GS = 0x1d;
const FS = 0x1c;

/* Inside a `GS ( k` stream the model, module-size and ECC commands are 9 + 8 + 8
   bytes, so the store-data header always starts at 25 and its length pair sits
   at these two offsets. */
const PL_INDEX = 28;
const PH_INDEX = 29;

function b(bytes: Uint8Array): number[] {
  return Array.from(bytes);
}

describe("ESC/POS commands", () => {
  it("matches the documented byte sequences", () => {
    expect(b(init())).toEqual([ESC, 0x40]);
    expect(b(selectCodepage(17))).toEqual([ESC, 0x74, 17]);
    expect(b(align("left"))).toEqual([ESC, 0x61, 0]);
    expect(b(align("center"))).toEqual([ESC, 0x61, 1]);
    expect(b(align("right"))).toEqual([ESC, 0x61, 2]);
    expect(b(bold(true))).toEqual([ESC, 0x45, 1]);
    expect(b(bold(false))).toEqual([ESC, 0x45, 0]);
    expect(b(feed(3))).toEqual([ESC, 0x64, 3]);
    expect(b(cut(10))).toEqual([GS, 0x56, 66, 10]);
    expect(b(cancelKanjiMode())).toEqual([FS, 0x2e]);
    expect(b(selectKanjiMode())).toEqual([FS, 0x26]);
  });

  describe("GS ! magnification", () => {
    it("packs width in the high nibble and height in the low, each minus one", () => {
      expect(b(size(1, 1))).toEqual([GS, 0x21, 0x00]);
      expect(b(size(2, 2))).toEqual([GS, 0x21, 0x11]);
      expect(b(size(1, 2))).toEqual([GS, 0x21, 0x01]);
      expect(b(size(2, 1))).toEqual([GS, 0x21, 0x10]);
      expect(b(size(8, 8))).toEqual([GS, 0x21, 0x77]);
    });

    it("clamps out-of-range multipliers instead of emitting a corrupt byte", () => {
      expect(b(size(0, 0))).toEqual([GS, 0x21, 0x00]);
      expect(b(size(99, 99))).toEqual([GS, 0x21, 0x77]);
    });
  });

  it("clamps byte parameters so a bad argument cannot desynchronise the stream", () => {
    // A parameter above 255 would otherwise wrap and the printer would read the
    // following command byte as data.
    expect(b(feed(300))).toEqual([ESC, 0x64, 255]);
    expect(b(feed(-5))).toEqual([ESC, 0x64, 0]);
    expect(b(selectCodepage(999))).toEqual([ESC, 0x74, 255]);
  });

  describe("text", () => {
    it("encodes through the selected code page", () => {
      expect(b(text("і", "cp1251"))).toEqual([0xb3]);
      expect(b(text("і", "cp1125"))).toEqual([0xf7]);
    });

    it("appends a line feed for line()", () => {
      expect(b(line("AB", "cp1251"))).toEqual([0x41, 0x42, 0x0a]);
    });
  });

  describe("GS ( k QR", () => {
    it("emits model, module size, ECC, store and print in order", () => {
      const data = "abc";
      const out = b(qr(data, 5, "M"));

      expect(out.slice(0, 9)).toEqual([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 50, 0x00]);
      expect(out.slice(9, 17)).toEqual([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 5]);
      expect(out.slice(17, 25)).toEqual([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 49]);
      // Store: pL/pH count the payload plus the 3-byte cn/fn/m header.
      expect(out.slice(25, 33)).toEqual([GS, 0x28, 0x6b, 6, 0x00, 0x31, 0x50, 0x30]);
      expect(out.slice(33, 36)).toEqual([0x61, 0x62, 0x63]);
      expect(out.slice(36)).toEqual([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    });

    it("splits the store length across pL/pH for payloads over 255 bytes", () => {
      const long = "x".repeat(300);
      const out = b(qr(long));
      // The three preceding commands are fixed length (9 + 8 + 8), so the store
      // header always begins at 25 and pL/pH sit at 28/29.
      expect(out.slice(25, 28)).toEqual([GS, 0x28, 0x6b]);
      // 300 + 3 = 303 = 0x012F
      expect(out[PL_INDEX]).toBe(0x2f);
      expect(out[PH_INDEX]).toBe(0x01);
    });

    it("selects the requested error-correction level", () => {
      expect(b(qr("a", 4, "L")).slice(17, 25)).toEqual([GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 48]);
      expect(b(qr("a", 4, "H")).slice(17, 25)).toEqual([GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 51]);
    });

    it("clamps module size to the 1..16 dot range the command allows", () => {
      expect(b(qr("a", 0)).slice(9, 17)).toEqual([GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 1]);
      expect(b(qr("a", 99)).slice(9, 17)).toEqual([GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 16]);
    });

    it("encodes the payload as UTF-8 bytes, not characters", () => {
      // A URL is ASCII, but the length is a byte count: "é" is two bytes, and
      // getting this wrong shifts everything after the store command.
      const out = b(qr("é"));
      expect(out[PL_INDEX]).toBe(5); // 2 payload bytes + 3-byte header
      expect(out.slice(33, 35)).toEqual([0xc3, 0xa9]);
    });
  });

  describe("GS v 0 raster", () => {
    it("writes bytes-per-row and row count as little-endian pairs", () => {
      // 384 dots = 48 bytes per row; 2 rows of data.
      const bitmap = new Uint8Array(96);
      const out = b(raster(bitmap, DOTS_PER_LINE));
      expect(out.slice(0, 8)).toEqual([GS, 0x76, 0x30, 0x00, 48, 0x00, 2, 0x00]);
      expect(out.length).toBe(8 + 96);
    });

    it("ignores a trailing partial row rather than sending a short one", () => {
      const bitmap = new Uint8Array(96 + 10);
      const out = b(raster(bitmap, DOTS_PER_LINE));
      expect(out[6]).toBe(2);
      expect(out.length).toBe(8 + 96);
    });

    it("splits a row count above 255 across yL/yH", () => {
      const bitmap = new Uint8Array(48 * 300);
      const out = b(raster(bitmap, DOTS_PER_LINE));
      expect(out[6]).toBe(300 & 0xff);
      expect(out[7]).toBe(300 >> 8);
    });
  });

  it("keeps the hardware constants consistent", () => {
    // 384 dots / 12-dot Font A = 32 columns. If either constant moves without
    // the other, every layout calculation silently goes wrong.
    expect(DOTS_PER_LINE / 12).toBe(COLUMNS_FONT_A);
  });

  describe("concat", () => {
    it("joins chunks in order", () => {
      expect(b(concat([new Uint8Array([1, 2]), new Uint8Array([3])]))).toEqual([1, 2, 3]);
    });

    it("handles an empty list", () => {
      expect(b(concat([]))).toEqual([]);
    });
  });

  describe("Receipt builder", () => {
    it("composes the same bytes as the underlying commands", () => {
      const built = new Receipt("cp1251").init(17).bold(true).line("A").feed(2).build();

      expect(b(built)).toEqual([
        ...b(init()),
        ...b(cancelKanjiMode()),
        ...b(selectCodepage(17)),
        ...b(bold(true)),
        0x41,
        0x0a,
        ...b(feed(2)),
      ]);
    });

    it("cancels double-byte mode before selecting a page, never after", () => {
      // Order is the whole point: `ESC t n` is ignored while the printer is in
      // double-byte mode, so selecting a page first would silently do nothing.
      const built = b(new Receipt("cp1251").init(17).build());
      expect(built.indexOf(0x2e)).toBeGreaterThan(built.indexOf(0x40));
      expect(built.indexOf(0x74)).toBeGreaterThan(built.indexOf(0x2e));
    });

    it("still leaves double-byte mode when no code page is given", () => {
      expect(b(new Receipt("cp1251").init().build())).toEqual([ESC, 0x40, FS, 0x2e]);
    });

    it("turns a blank string into a blank line", () => {
      expect(b(new Receipt("cp1251").lines(["A", "", "B"]).build())).toEqual([
        0x41, 0x0a, 0x0a, 0x42, 0x0a,
      ]);
    });
  });
});
