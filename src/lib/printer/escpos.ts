/**
 * ESC/POS command bytes for the XP-58 (58 mm roll, 384 dots per line, 203 dpi).
 *
 * Why this exists at all: printing the receipt through the browser hands the
 * Windows driver a grey, antialiased bitmap, and the driver then dithers it
 * down to the 1-bit the thermal head actually is. Thin stems become dotted and
 * read as grey. Building the byte stream ourselves lets the printer set the
 * text in its own ROM font, where every stem is a whole dot that is either
 * burned or not — the same path the printer's self-test uses.
 *
 * Every command is a plain function returning bytes so it can be asserted
 * against a reference chart in tests. `Receipt` is a thin builder over them.
 */

import { encode, type Bytes, type Codepage } from "./codec";

const ESC = 0x1b;
const GS = 0x1d;

/** 384 dots at 203 dpi = 48.0 mm exactly — the full printable width. */
export const DOTS_PER_LINE = 384;

/** Font A is 12 dots wide, so 384 / 12 = 32 characters per line. */
export const COLUMNS_FONT_A = 32;

export type Align = "left" | "center" | "right";

const ALIGN_CODES: Record<Align, number> = { left: 0, center: 1, right: 2 };

/** QR error correction. Higher survives more smudging but yields a denser code. */
export type QrEcc = "L" | "M" | "Q" | "H";

const ECC_CODES: Record<QrEcc, number> = { L: 48, M: 49, Q: 50, H: 51 };

export function concat(chunks: readonly Bytes[]): Bytes {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Clear all modes and reset the buffer. Always send this first. */
export function init(): Bytes {
  return new Uint8Array([ESC, 0x40]);
}

/**
 * Select a ROM code page (`ESC t n`). Which number holds which page is a
 * firmware property — see the probe page, not a spec.
 */
export function selectCodepage(n: number): Bytes {
  return new Uint8Array([ESC, 0x74, clampByte(n)]);
}

export function align(mode: Align): Bytes {
  return new Uint8Array([ESC, 0x61, ALIGN_CODES[mode]]);
}

export function bold(on: boolean): Bytes {
  return new Uint8Array([ESC, 0x45, on ? 1 : 0]);
}

export function underline(on: boolean): Bytes {
  return new Uint8Array([ESC, 0x2d, on ? 1 : 0]);
}

/**
 * Character magnification (`GS !`). Both multipliers are 1..8 and are encoded
 * as (value - 1), width in the high nibble.
 */
export function size(widthMultiplier: number, heightMultiplier: number): Bytes {
  const w = clampRange(widthMultiplier, 1, 8) - 1;
  const h = clampRange(heightMultiplier, 1, 8) - 1;
  return new Uint8Array([GS, 0x21, (w << 4) | h]);
}

/** Feed n blank lines (`ESC d n`). */
export function feed(lines: number): Bytes {
  return new Uint8Array([ESC, 0x64, clampByte(lines)]);
}

/**
 * Line spacing in dot units (`ESC 3 n`); `defaultLineSpacing` restores the
 * firmware default (`ESC 2`). Tightening this is the cheapest way to save roll.
 */
export function lineSpacing(dots: number): Bytes {
  return new Uint8Array([ESC, 0x33, clampByte(dots)]);
}

export function defaultLineSpacing(): Bytes {
  return new Uint8Array([ESC, 0x32]);
}

/**
 * Partial cut after feeding `feedDots` (`GS V 66 n`).
 *
 * The base XP-58 has no cutter — it has a tear bar — so this is opt-in and the
 * receipt builder feeds blank lines instead by default. Sending a cut to a
 * printer without one is harmless but pointless.
 */
export function cut(feedDots = 0): Bytes {
  return new Uint8Array([GS, 0x56, 66, clampByte(feedDots)]);
}

/** Text in the currently selected code page. Does not append a newline. */
export function text(value: string, page: Codepage): Bytes {
  return encode(value, page);
}

/** Text plus a line feed. */
export function line(value: string, page: Codepage): Bytes {
  return concat([encode(value, page), new Uint8Array([0x0a])]);
}

export function newline(): Bytes {
  return new Uint8Array([0x0a]);
}

/**
 * Literal 7-bit ASCII, bypassing the code page entirely.
 *
 * The low half of every ROM page is plain ASCII, so this renders identically no
 * matter which page is selected. That makes it the only safe way to label
 * output while sweeping `ESC t n` looking for a working page — a Cyrillic
 * label would itself become unreadable at exactly the values under test.
 */
export function ascii(value: string): Bytes {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0x7f;
  return out;
}

/**
 * A QR code drawn by the printer itself (`GS ( k`).
 *
 * This is the reason the QR problem disappears rather than improving: no image
 * is transferred, no resampling happens, and every module lands on an exact
 * multiple of printer dots. `moduleSize` is that multiple, 1..16 dots.
 */
export function qr(data: string, moduleSize = 5, ecc: QrEcc = "M"): Bytes {
  const payload = new TextEncoder().encode(data);

  // Store-data carries a 3-byte header (cn, fn, m) ahead of the payload.
  const storeLength = payload.length + 3;
  const pL = storeLength & 0xff;
  const pH = (storeLength >> 8) & 0xff;

  return concat([
    // Model 2
    new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 50, 0x00]),
    // Module size in dots
    new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, clampRange(moduleSize, 1, 16)]),
    // Error correction level
    new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ECC_CODES[ecc]]),
    // Store the payload in the symbol buffer
    new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    payload,
    // Print what was stored
    new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  ]);
}

/**
 * Raster bit image (`GS v 0`), 1 bit per dot, MSB leftmost.
 *
 * Unused while the ROM font carries the text, but kept because it is the
 * fallback if the firmware turns out to have no Ukrainian code page: we would
 * then rasterise the receipt ourselves at exactly 384 px and threshold it to
 * pure black and white. Even that beats browser printing, because no driver
 * gets a chance to dither.
 *
 * @param bitmap packed rows, `Math.ceil(widthDots / 8)` bytes per row
 */
export function raster(bitmap: Bytes, widthDots: number): Bytes {
  const bytesPerRow = Math.ceil(widthDots / 8);
  if (bytesPerRow === 0) return new Uint8Array();

  const rows = Math.floor(bitmap.length / bytesPerRow);

  return concat([
    new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00, // normal scale
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      rows & 0xff,
      (rows >> 8) & 0xff,
    ]),
    bitmap.subarray(0, rows * bytesPerRow),
  ]);
}

function clampByte(n: number): number {
  return clampRange(Math.round(n), 0, 255);
}

function clampRange(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Fluent composer over the commands above. Holds the selected code page so
 * callers pass text, not encodings.
 */
export class Receipt {
  private readonly parts: Bytes[] = [];

  constructor(private readonly page: Codepage) {}

  raw(bytes: Bytes): this {
    this.parts.push(bytes);
    return this;
  }

  init(codepageIndex?: number): this {
    this.parts.push(init());
    if (codepageIndex !== undefined) this.parts.push(selectCodepage(codepageIndex));
    return this;
  }

  align(mode: Align): this {
    return this.raw(align(mode));
  }

  bold(on: boolean): this {
    return this.raw(bold(on));
  }

  size(width: number, height: number): this {
    return this.raw(size(width, height));
  }

  text(value: string): this {
    return this.raw(text(value, this.page));
  }

  line(value = ""): this {
    return this.raw(line(value, this.page));
  }

  /** Several lines at once; blank strings become blank lines. */
  lines(values: readonly string[]): this {
    for (const value of values) this.line(value);
    return this;
  }

  feed(count: number): this {
    return this.raw(feed(count));
  }

  qr(data: string, moduleSize?: number, ecc?: QrEcc): this {
    return this.raw(qr(data, moduleSize, ecc));
  }

  build(): Bytes {
    return concat(this.parts);
  }
}
