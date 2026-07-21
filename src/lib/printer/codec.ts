/**
 * Text → single-byte code page, for ESC/POS thermal printers.
 *
 * An ESC/POS printer has no Unicode. It holds a set of 256-glyph ROM pages and
 * `ESC t n` picks one; every byte we send afterwards indexes into it. So the
 * whole receipt has to survive a trip through one 8-bit page.
 *
 * That is a real constraint for Ukrainian, not a formality:
 *   - CP1251 covers the alphabet completely, і/І/ї/Ї/є/Є/ґ/Ґ included.
 *   - CP866 does NOT contain і/І — the single most common Ukrainian letter.
 *     Its 0xF0..0xF7 block is Ё ё Є є Ї ї Ў ў, Russian-oriented.
 *   - CP1125 is the Ukrainian rebuild of CP866: same first 240 glyphs, but
 *     0xF0..0xF7 becomes Ґ ґ Є є Ї ї І і. It covers Ukrainian.
 *
 * Which of the three this particular XP-58 actually has in ROM, and under which
 * `ESC t` number, is a property of the firmware and cannot be looked up — the
 * Xprinter tables differ from Epson's. It has to be printed and read off paper,
 * which is what the probe page does. All three live here so the probe can try
 * each one.
 */

export type Codepage = "cp1251" | "cp866" | "cp1125";

export const CODEPAGES: readonly Codepage[] = ["cp1251", "cp866", "cp1125"];

/**
 * A byte buffer pinned to a plain `ArrayBuffer`.
 *
 * Since TypeScript 5.7 `Uint8Array` is generic over its backing buffer and
 * defaults to `ArrayBufferLike`, which admits `SharedArrayBuffer`. WebUSB's
 * `transferOut` accepts only `ArrayBuffer`-backed views, so every buffer that
 * can end up at the printer is typed this way — the alternative is a cast at
 * the transfer call, which would move a real constraint out of the type system.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

/* The upper half (bytes 0x80..0xFF) of each page, as a 128-character string.
   Index 0 is byte 0x80. Written literally rather than generated: the ranges are
   only partly contiguous, and a table you can read against a reference chart is
   worth more here than clever construction. U+FFFD marks a position with no
   assigned glyph. */

const CP1251_UPPER =
  "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏ" + // 80-8F
  "ђ‘’“”•–—�™љ›њќћџ" + // 90-9F
  " ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї" + // A0-AF
  "°±Ііґµ¶·ё№є»јЅѕї" + // B0-BF
  "АБВГДЕЖЗИЙКЛМНОП" + // C0-CF  А..П
  "РСТУФХЦЧШЩЪЫЬЭЮЯ" + // D0-DF  Р..Я
  "абвгдежзийклмноп" + // E0-EF  а..п
  "рстуфхцчшщъыьэюя"; // F0-FF  р..я

/* CP866 and CP1125 share everything below 0xF0 — Cyrillic in three runs with the
   DOS box-drawing block wedged at 0xB0..0xDF. */
const DOS_CYRILLIC_SHARED =
  "АБВГДЕЖЗИЙКЛМНОП" + // 80-8F  А..П
  "РСТУФХЦЧШЩЪЫЬЭЮЯ" + // 90-9F  Р..Я
  "абвгдежзийклмноп" + // A0-AF  а..п
  "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐" + // B0-BF
  "└┴┬├─┼╞╟╚╔╩╦╠═╬╧" + // C0-CF
  "╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀" + // D0-DF
  "рстуфхцчшщъыьэюя"; // E0-EF  р..я

/* 0xF8..0xFF is also shared; only 0xF0..0xF7 tells the two pages apart. */
const DOS_TAIL_SHARED = "°∙·√№¤■ "; // F8-FF

const CP866_UPPER =
  DOS_CYRILLIC_SHARED +
  "ЁёЄєЇїЎў" + // F0-F7  Ё ё Є є Ї ї Ў ў  — no і/І
  DOS_TAIL_SHARED;

const CP1125_UPPER =
  DOS_CYRILLIC_SHARED +
  "ҐґЄєЇїІі" + // F0-F7  Ґ ґ Є є Ї ї І і
  DOS_TAIL_SHARED;

const UPPER_HALVES: Record<Codepage, string> = {
  cp1251: CP1251_UPPER,
  cp866: CP866_UPPER,
  cp1125: CP1125_UPPER,
};

/**
 * Characters no Cyrillic code page carries, mapped to something that survives.
 *
 * Applied before layout, never at encode time, and deliberately page-agnostic:
 * `₴` becomes three characters, so if this ran during encoding the column
 * arithmetic in layout.ts would already have been done against the wrong
 * length and the price column would sit crooked. Page-agnostic so that the
 * receipt occupies identical columns whichever page the firmware turns out to
 * support — the layout must not shift when the probe result changes.
 */
const SUBSTITUTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/₴/g, "грн"], // ₴ — absent from every 8-bit Cyrillic page
  [/[–—−]/g, "-"], // – — −
  [/[‘’‛ʼ]/g, "'"], // ' ' ‛ ʼ
  [/[“”„«»]/g, '"'], // " " „ « »
  [/…/g, "..."], // …
  [/•/g, "*"], // •
  [/[   ]/g, " "], // no-break / thin spaces
  [/­/g, ""], // soft hyphen
];

/**
 * Fold text down to what a Cyrillic ROM page can render, without changing the
 * character count afterwards. Idempotent, so it is safe to apply twice.
 * Call this before measuring or wrapping text for a fixed-column layout.
 */
export function normalizeForPrinter(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SUBSTITUTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/* Reverse lookups are built once per page on first use. Building all three
   eagerly would cost three 128-entry Maps for pages we will never select. */
const reverseCache = new Map<Codepage, Map<string, number>>();

function reverseMap(page: Codepage): Map<string, number> {
  const cached = reverseCache.get(page);
  if (cached) return cached;

  const upper = UPPER_HALVES[page];
  const map = new Map<string, number>();
  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];
    // Unassigned slots, and duplicates from an earlier byte, must not win.
    if (char === "�" || map.has(char)) continue;
    map.set(char, 0x80 + i);
  }

  reverseCache.set(page, map);
  return map;
}

/** Stand-in for a character the selected page cannot represent. */
const UNMAPPED_BYTE = 0x3f; // '?'

/**
 * Encode text for the given ROM page. Never throws: anything unrepresentable
 * becomes '?', because a receipt with one wrong glyph still prints and a
 * receipt that threw does not.
 *
 * Newlines are passed through as 0x0A — the printer treats that as "print this
 * line and advance", which is exactly what we want.
 */
export function encode(text: string, page: Codepage): Bytes {
  const normalized = normalizeForPrinter(text);
  const reverse = reverseMap(page);
  const bytes = new Uint8Array(normalized.length);

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code < 0x80) {
      bytes[i] = code;
      continue;
    }
    bytes[i] = reverse.get(normalized[i]) ?? UNMAPPED_BYTE;
  }

  return bytes;
}

/**
 * Whether a page can render every character of the given text. Used by the
 * probe to say plainly which candidate pages are viable for Ukrainian, rather
 * than leaving it to be eyeballed off the paper.
 */
export function canEncode(text: string, page: Codepage): boolean {
  const normalized = normalizeForPrinter(text);
  const reverse = reverseMap(page);

  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code < 0x80) continue;
    if (!reverse.has(char)) return false;
  }

  return true;
}
