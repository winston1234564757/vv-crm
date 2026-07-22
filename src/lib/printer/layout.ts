/**
 * Fixed-column text layout for the receipt.
 *
 * The XP-58 prints 384 dots per line and Font A is 12 dots wide, so a line is
 * exactly 32 characters. There is no proportional spacing to fall back on:
 * alignment here is character counting, and a line one character too long does
 * not shrink, it wraps and drags the rest of the receipt out of shape.
 *
 * Every function takes and returns plain strings, so none of this depends on
 * which ROM code page the printer turned out to have. It does depend on one
 * property the codec guarantees: after {@link normalizeForPrinter}, one
 * character encodes to exactly one byte, so `String.length` is the printed
 * width. That is why these functions normalise on the way in — measuring before
 * normalising would count `₴` as one column when it prints as three.
 */

import { normalizeForPrinter } from "./codec";

/** Font A on a 58 mm roll: 384 / 12 = 32. */
export const DEFAULT_WIDTH = 32;

/**
 * Break text into lines of at most `width` characters, splitting on spaces.
 *
 * Words longer than the line — IMEIs, serial numbers, some model names — are
 * hard-split rather than allowed to overflow. Losing the tail of an IMEI to the
 * paper edge would make the receipt useless as a record of which device was
 * taken in.
 */
export function wrap(text: string, width = DEFAULT_WIDTH): string[] {
  const normalized = normalizeForPrinter(text);
  const out: string[] = [];

  for (const paragraph of normalized.split("\n")) {
    const words = paragraph.split(" ").filter((w) => w.length > 0);

    if (words.length === 0) {
      out.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      if (current.length === 0) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current += " " + word;
      } else {
        out.push(current);
        current = word;
      }

      // The word itself may still exceed the line; emit full-width pieces
      // until what remains fits.
      while (current.length > width) {
        out.push(current.slice(0, width));
        current = current.slice(width);
      }
    }

    if (current.length > 0) out.push(current);
  }

  return out;
}

/**
 * Label on the left, value on the right, padded apart to fill the line.
 *
 * When the pair cannot fit, the value moves to its own right-aligned line
 * rather than being truncated — a total that has lost its last digit is worse
 * than a total on the next line.
 */
export function labelValue(label: string, value: string, width = DEFAULT_WIDTH): string[] {
  const left = normalizeForPrinter(label);
  const right = normalizeForPrinter(value);

  if (left.length + 1 + right.length <= width) {
    return [left + " ".repeat(width - left.length - right.length) + right];
  }

  const out = wrap(left, width);
  for (const line of wrap(right, width)) out.push(alignRight(line, width));
  return out;
}

export function alignRight(text: string, width = DEFAULT_WIDTH): string {
  const value = normalizeForPrinter(text);
  if (value.length >= width) return value;
  return " ".repeat(width - value.length) + value;
}

export function alignCenter(text: string, width = DEFAULT_WIDTH): string {
  const value = normalizeForPrinter(text);
  if (value.length >= width) return value;
  // Odd remainders lean left, which reads better than a ragged right edge.
  const left = Math.floor((width - value.length) / 2);
  return " ".repeat(left) + value;
}

/** A full-width rule. */
export function divider(width = DEFAULT_WIDTH, char = "-"): string {
  return char.repeat(width);
}

/**
 * One line item, as a name block followed by an indented arithmetic line.
 *
 * A three-column table (name / qty / sum) is the obvious shape and the wrong
 * one at 32 characters: after the quantity and money columns, roughly twelve
 * remain for the name, so every real product name wraps to three ragged lines.
 * Giving the name the full width and putting `qty x price = total` on its own
 * right-aligned line costs the same vertical space and stays readable.
 */
export function itemLines(
  name: string,
  quantity: number,
  unitPrice: number,
  total: number,
  width = DEFAULT_WIDTH,
): string[] {
  const lines = wrap(name, width);
  const math = `${quantity} x ${money(unitPrice)} = ${money(total)}`;
  lines.push(alignRight(math, width));
  return lines;
}

/**
 * Money with thin-space grouping folded to a plain space.
 *
 * `toLocaleString` is deliberately not used: under a Ukrainian locale it emits
 * U+00A0 as the group separator, which normalisation would turn into a space
 * anyway — but only after the width had already been measured somewhere. Doing
 * the grouping here keeps the printed width predictable.
 */
export function money(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();

  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += " ";
    grouped += digits[i];
  }

  return `${sign}${grouped}`;
}
