# POS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the POS sales screen (`/admin/sales/pos`) so product names never truncate and the page runs on the v2 design tokens — visual + layout only, no behavioural change.

**Architecture:** Three presentational React files edited in place. The cart line item becomes a two-row card (name on its own line, controls below). Catalog product/service names drop `line-clamp`. Legacy design tokens are swapped for v2 tokens across all three files. No hooks, server actions, prop shapes, or state change.

**Tech Stack:** Next.js (App Router), React client components, Tailwind v4 with `@theme` tokens (`globals.css`), framer-motion (already present, untouched).

## Global Constraints

- **Presentational only.** Edit exactly `src/app/admin/sales/pos/POSClient.tsx`, `POSCartSidebar.tsx`, `POSCatalog.tsx`. No new props, no state, no logic changes.
- **Do NOT modify:** `usePOSCart.ts`, `usePOSCatalog.ts`, `pos-types.ts`, server actions, checkout payload, `ReceiptPrintModal`, success-dialog logic (markup token-migrated only).
- **No name truncation anywhere** — cart items and catalog product/service cards. Names wrap in full; IMEI/SKU wrap, never truncate.
- **Desktop + mouse density.** No oversized touch targets.
- **Token migration table** (apply verbatim in every task):

  | Legacy | v2 |
  |---|---|
  | `violet` | `accent` |
  | `violet-hover` | `accent-hover` |
  | `violet/10`, `violet/5`, `violet/20`, `violet/30` | `accent/10`, `accent/5`, `accent/20`, `accent/30` |
  | `warm-surface` | `elevated` |
  | `warm-sidebar` | `sidebar` |
  | `warm-border` | `border` |
  | `text-primary` | `ink` |
  | `text-secondary` | `muted` |
  | `text-secondary/50`, `text-secondary/40`, `text-secondary/60` | `faint` |
  | `iris` | `muted` |
  | `rose` | `danger` |
  | `amber` | `warning` |
  | `emerald` | `success` |
  | `cyan` | `info` |

  Category bento colours map by meaning: техніка=`info`, аксесуари=`accent`, запчастини=`warning`, послуги=`success`. Radii stay on Tailwind utilities.

- **Verification per task** (no unit tests exist for markup): `npx tsc --noEmit` clean, `npx eslint <file>` clean. Final visual QA is the owner's job.

---

### Task 1: Cart line item → two-row card + token migration (`POSCartSidebar.tsx`)

**Files:**
- Modify: `src/app/admin/sales/pos/POSCartSidebar.tsx`

**Interfaces:**
- Consumes: existing `POSCartSidebarProps` — unchanged. Uses `cart: CartItem[]`, `updateQty`, `updatePrice`. `CartItem` has `id, item_type, name, imei?, sku?, unit_price, unit_cost, quantity`.
- Produces: nothing new (same component signature, same props).

- [ ] **Step 1: Replace the cart item row markup with a two-row card**

Find the `cart.map((item) => { ... })` block (the `motion.div` per item, currently lines ~168-256). Replace the inner layout so name and controls no longer share a row. The `motion.div` wrapper, keys, and animation props stay; only the inside changes to:

```tsx
{cart.map((item) => {
  const itemTotal = item.unit_price * item.quantity;
  const isUnderCost = item.unit_price < item.unit_cost;
  const typeLabel =
    item.item_type === "device" ? "Девайс" :
    item.item_type === "accessory" ? "Аксесуар" :
    item.item_type === "part" ? "Деталь" : "Послуга";
  const badgeClass =
    item.item_type === "device" ? "bg-info/15 text-info" :
    item.item_type === "accessory" ? "bg-accent/15 text-accent" :
    item.item_type === "part" ? "bg-warning/15 text-warning" : "bg-success/15 text-success";
  return (
    <motion.div
      key={`${item.id}-${item.item_type}`}
      initial={{ opacity: 0, height: 0, y: 12 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -12 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`rounded-xl bg-surface border p-3 space-y-2.5 transition-colors duration-200 overflow-hidden ${
        isUnderCost ? "border-warning/45 bg-warning/[0.03]" : "border-border/60 hover:border-accent/25"
      }`}
    >
      {/* Row 1: badge + full name + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${badgeClass}`}>
            {typeLabel}
          </span>
          <p className="text-xs font-semibold text-ink leading-snug">{item.name}</p>
          {item.imei && <p className="text-[9px] text-muted font-mono break-all">IMEI: {item.imei}</p>}
          {item.sku && <p className="text-[9px] text-muted break-all">SKU: {item.sku}</p>}
        </div>
        <button
          type="button"
          onClick={() => updateQty(item.id, item.item_type, -item.quantity)}
          aria-label="Видалити позицію"
          className="btn-press shrink-0 p-1 rounded text-danger hover:bg-danger/10 transition-colors cursor-pointer"
        >
          <IconDelete size={14} />
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Row 2: qty · price(+cost) · line total */}
      <div className="flex items-center justify-between gap-2">
        {item.item_type !== "device" ? (
          <div className="flex items-center border border-border rounded-lg bg-elevated overflow-hidden">
            <button type="button" onClick={() => updateQty(item.id, item.item_type, -1)} className="px-2.5 py-1 text-xs font-bold text-ink hover:bg-accent/10">−</button>
            <span className="px-2 text-xs font-medium text-ink tabular">{item.quantity}</span>
            <button type="button" onClick={() => updateQty(item.id, item.item_type, 1)} className="px-2.5 py-1 text-xs font-bold text-ink hover:bg-accent/10">+</button>
          </div>
        ) : (
          <span className="text-xs text-muted font-medium">1 шт.</span>
        )}

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={item.unit_price}
                onChange={e => updatePrice(item.id, item.item_type, e.target.value)}
                className={`w-16 rounded border text-right px-1.5 py-0.5 text-xs outline-none tabular ${
                  isUnderCost ? "border-warning text-warning font-semibold bg-warning/5" : "border-border text-ink focus:border-accent"
                }`}
              />
              <span className="text-xs text-muted">₴</span>
            </div>
            <span className={`text-[9px] mt-0.5 ${isUnderCost ? "text-warning font-semibold" : "text-muted"}`}>
              соб. <span className="font-mono">{item.unit_cost} ₴</span>
            </span>
          </div>
          <span className="text-sm font-bold text-ink tabular min-w-[64px] text-right">{itemTotal} ₴</span>
        </div>
      </div>
    </motion.div>
  );
})}
```

- [ ] **Step 2: Migrate the rest of the file's tokens**

Apply the Global Constraints token table to every remaining className in this file: the wrapper `div` (line ~86, `bg-surface shadow-... border border-warm-border` → keep `bg-surface`, `border-warm-border`→`border-border`), header badge (`text-violet bg-violet/10`→`text-accent bg-accent/10`), client select + new-customer block (`border-iris/20`→`border-border`, `focus:border-violet`→`focus:border-accent`, `bg-violet/5`→`bg-accent/5`, `border-violet/20`→`border-accent/20`, `bg-violet text-white`→`bg-accent text-on-accent`, `text-rose`→`text-danger`), notes input, link-device checkbox (`bg-violet/5 border-violet/10`→`bg-accent/5 border-accent/10`, `text-violet`→`text-accent`), payment segmented control (`bg-violet`→`bg-accent` on the `layoutId` pill, `text-text-secondary`→`text-muted`, `text-text-primary`→`text-ink`), split inputs, summary (`text-emerald`→`text-success`, `text-violet font-extrabold`→`text-accent font-extrabold`, `border-iris/10`→`border-border`), error box (`bg-rose/10 border-rose/25 text-rose`→`bg-danger/10 border-danger/25 text-danger`), submit button (`bg-violet hover:bg-violet-hover text-white`→`bg-accent hover:bg-accent-hover text-on-accent`). Leave framer-motion props and all handlers exactly as-is.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Lint the file**

Run: `npx eslint src/app/admin/sales/pos/POSCartSidebar.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/sales/pos/POSCartSidebar.tsx
git commit -m "feat(pos): two-row cart item, no name truncation, v2 tokens"
```

---

### Task 2: Catalog names in full + token migration (`POSCatalog.tsx`)

**Files:**
- Modify: `src/app/admin/sales/pos/POSCatalog.tsx`

**Interfaces:**
- Consumes: existing `POSCatalogProps` — unchanged.
- Produces: nothing new.

- [ ] **Step 1: Remove name truncation on product cards**

Find the product card name (`<h4 ... line-clamp-2>` at ~line 290). Remove `line-clamp-2` so the name shows in full:

```tsx
<h4 className="text-xs font-bold text-ink leading-snug">
  {displayName}
</h4>
```

Then for the IMEI/SKU lines just below it, replace `truncate` with wrapping and migrate colour:

```tsx
{displayImei && (
  <p className="text-[9px] text-muted font-mono mt-1 break-all">
    IMEI: {displayImei}
  </p>
)}
{displaySku && (
  <p className="text-[9px] text-muted mt-1 break-all">
    SKU: {displaySku}
  </p>
)}
```

- [ ] **Step 2: Migrate the rest of the file's tokens**

Apply the token table across the file: header card (`border-warm-border/50`→`border-border/50`, `text-violet`→`text-accent`, `text-text-primary`→`text-ink`), "Назад до категорій" button (`bg-violet/10 hover:bg-violet/20 border-violet/30 text-violet`→`bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent`), the four bento category cards (`bg-cyan`→`bg-info`, `bg-violet`→`bg-accent`, `bg-amber`→`bg-warning`, `bg-emerald`→`bg-success`; keep `text-white`; `bg-surface/25`→`bg-white/20`), search input (`border-warm-border`→`border-border`, `text-text-primary`→`text-ink`, `focus:border-violet/40`→`focus:border-accent/40`, `text-text-secondary`→`text-muted`), accessory subcategory chips (`bg-violet text-white`→`bg-accent text-on-accent`, `border-warm-border text-text-secondary hover:text-text-primary hover:border-violet/30`→`border-border text-muted hover:text-ink hover:border-accent/30`), empty state (`text-text-secondary/50`→`text-faint`, `border-warm-border/50`→`border-border/50`), product card container (`border-warm-border/50 hover:border-violet/30`→`border-border/50 hover:border-accent/30`), product visual backgrounds (`bg-cyan/10 text-cyan`→`bg-info/10 text-info`, `from-violet/10 to-iris/5 text-violet`→`from-accent/10 to-accent/5 text-accent`, `bg-amber/10 text-amber`→`bg-warning/10 text-warning`, `bg-emerald/10 text-emerald`→`bg-success/10 text-success`, `bg-warm-surface`→`bg-elevated`, `border-warm-border/20`→`border-border/20`), stock badge (`bg-rose/10 text-rose`→`bg-danger/10 text-danger`, `bg-emerald/10 text-emerald`→`bg-success/10 text-success`), price + add (`text-violet`→`text-accent`, `bg-violet/5`→`bg-accent/5`, `border-iris/5`→`border-border`). Leave all framer-motion props and handlers as-is.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 4: Lint the file**

Run: `npx eslint src/app/admin/sales/pos/POSCatalog.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/sales/pos/POSCatalog.tsx
git commit -m "feat(pos): full product/service names in catalog, v2 tokens"
```

---

### Task 3: Wrapper, mobile tabs & success dialog token migration (`POSClient.tsx`)

**Files:**
- Modify: `src/app/admin/sales/pos/POSClient.tsx`

**Interfaces:**
- Consumes: unchanged props and the two child components from Tasks 1–2.
- Produces: nothing new.

- [ ] **Step 1: Migrate tokens in mobile tab switcher + success dialog**

Apply the token table to this file only (the layout/JSX structure stays identical): mobile tabs (`bg-warm-sidebar border-warm-border/50`→`bg-sidebar border-border/50`, `bg-surface text-text-primary`→`bg-surface text-ink`, `text-text-secondary hover:text-text-primary`→`text-muted hover:text-ink`, `bg-violet text-white`→`bg-accent text-on-accent`). Success dialog: `bg-ink/60` stays; `border-warm-border`→`border-border`; buttons — `border-warm-border/80 bg-warm-surface text-text-secondary ... hover:bg-iris/5`→`border-border bg-elevated text-muted ... hover:bg-accent/5`; keep the `bg-emerald`→`bg-success` print button and its `shadow-emerald/10`→`shadow-success/10`; `stroke-emerald`/`bg-emerald/15 text-emerald`→`stroke-success`/`bg-success/15 text-success`; the "перейти до списку" link `hover:text-violet`→`hover:text-accent`, `text-text-secondary/60`→`text-faint`. Leave the `dark:` variants and framer-motion/SVG animation code exactly as-is.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 3: Lint the file**

Run: `npx eslint src/app/admin/sales/pos/POSClient.tsx`
Expected: no errors.

- [ ] **Step 4: Production build sanity check**

Run: `npx next build`
Expected: build succeeds (compiles the POS route without type/lint errors).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/sales/pos/POSClient.tsx
git commit -m "feat(pos): v2 tokens for tabs and success dialog"
```

---

## Visual QA (owner's job — flag, don't skip)

After all three tasks, verify in-app (`/admin/sales/pos`):
- [ ] Long product names (e.g. "Захисне скло SKLO 5D (тех.пак) для Xiaomi Redmi Note 12") show in full in the cart **and** in catalog cards — no `…`.
- [ ] Under-cost price shows the `warning` treatment (border + hint).
- [ ] Qty stepper works for stock items; a device shows "1 шт.".
- [ ] Delete removes the line.
- [ ] Payment segmented control (Готівка/Картка/Split) animates; split inputs appear and auto-balance.
- [ ] Checkout completes and the success dialog + print modal look correct.
- [ ] Mobile tab switcher (Вітрина / Кошик) still toggles.
- [ ] Colours read as the teal-accent v2 system, consistent with the dashboard.
```
