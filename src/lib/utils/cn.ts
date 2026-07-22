import { twMerge } from "tailwind-merge";

/**
 * Joins class names and lets later ones win.
 *
 * This used to be a plain `filter(Boolean).join(" ")`, which meant a caller's
 * `className` never actually overrode a component's base classes: both landed
 * in the markup and whichever Tailwind emitted later in the stylesheet won.
 * The device toolbar showed exactly that — `w-auto py-0 text-xs` on the filter
 * selects lost to the `w-full py-2.5 text-base` baked into the field chrome,
 * so three selects rendered full width and stacked into a column.
 *
 * Every component in this codebase takes a `className` and merges it, so the
 * broken version made all of those overrides a coin flip.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
