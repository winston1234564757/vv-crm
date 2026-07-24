# POS Redesign — Design Spec

**Date:** 2026-07-23
**Page:** `/admin/sales/pos`
**Scope:** Visual + layout redesign. No behavioural/flow/data changes.

## Goal

Turn the POS sales screen into a clean, professional tool. The trigger complaint:
product names truncate in the cart (`За…`). Root cause: `POSCartSidebar.tsx`
line item name has a hard `truncate ... max-w-[140px]` because name, cost,
price editor, qty stepper, total and delete are all crammed into one horizontal
row.

Secondary goal: POS still runs on the **legacy** design tokens (`violet`,
`warm-*`, `text-primary`, `iris`, `rose`, `amber`, `emerald`, `cyan`) while the
dashboard has already migrated to the **v2** tokens. Migrate POS so it stops
looking foreign.

## Constraints (agreed)

- **Depth:** Visual + layout only. Same features, same flow.
- **Device:** Desktop + mouse primary → dense, mouse-optimized, no oversized
  touch targets.
- **No truncation of names anywhere** — neither cart line items nor catalog
  product/service cards. Names wrap and show in full. IMEI/SKU wrap, never
  truncate.

## Do NOT touch

Purely presentational edits (markup + Tailwind classes) in exactly three files:
`POSClient.tsx`, `POSCartSidebar.tsx`, `POSCatalog.tsx`.

Unchanged: `usePOSCart.ts`, `usePOSCatalog.ts`, `pos-types.ts`, all server
actions, the checkout payload shape, `ReceiptPrintModal`, and the success-dialog
logic (its markup gets token-migrated only). No new props, no state changes.

## 1. Design-system token migration (global, all three files)

Replace legacy tokens with v2 equivalents (values are near-identical; teal
accent stays):

| Legacy | v2 |
|---|---|
| `violet` | `accent` |
| `violet-hover` | `accent-hover` |
| `violet/10`, `violet/5` | `accent-subtle` (or `accent/10`) |
| `warm-surface` | `elevated` |
| `warm-sidebar` | `sidebar` |
| `warm-border` | `border` |
| `text-primary` | `ink` |
| `text-secondary` | `muted` |
| `text-secondary/50`, `/40` | `faint` |
| `iris` | `muted` |
| `rose` | `danger` |
| `amber` | `warning` |
| `emerald` | `success` |
| `cyan` | `info` |

Radii stay on Tailwind utilities (`rounded-xl`, etc.). Category bento colours
map by meaning: техніка=`info`, аксесуари=`accent`, запчастини=`warning`,
послуги=`success`.

## 2. Cart line item — two-row card (core fix)

Replace the single cramped row with a two-row card:

- **Top row:** coloured type badge + **full product name** (wraps, no
  `max-w`, no `line-clamp`), delete (trash) icon pinned top-right.
- **Meta line:** IMEI / SKU when present (mono, `faint`, wraps).
- **Divider.**
- **Bottom row (controls):** left — qty stepper `− N +` for stock items, or
  `1 шт.` for a device; right — price editor input with `соб. NN ₴` hint beneath
  it and the **line total** in bold. Under-cost state (`unit_price < unit_cost`)
  keeps the current amber→now-`warning` treatment on the price input + hint.

Name never competes with controls for width → truncation is structurally gone.

## 3. Left panel overall

`card` wrapper, cleaner spacing/hierarchy. Order unchanged: header + count
badge → client select → scrollable items list → checkout (note, link-device
checkbox, payment segmented control with animated `accent` pill, split inputs,
summary rows, submit). Restyle only.

## 4. Right column — catalog

Mostly token migration + spacing alignment; structure already works. Keep the
colourful bento category grid. Product card: image/icon, **name in full
(remove `line-clamp-2`)**, IMEI/SKU wrapping, price + "+ Додати". Uneven card
heights from full names are acceptable (grid rows stretch).

## 5. QA (visual — owner's job)

No unit-test impact. Checklist to verify in-app:
- Long product names wrap fully in both cart and catalog (no `…`).
- Under-cost warning styling on price.
- Split payment inputs + animated payment pill.
- Device (`1 шт.`) vs stock item (`− N +`) qty behaviour.
- Mobile tab switcher (Вітрина / Кошик).
- Dark theme, if applicable.
