# Impeccable Global Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the entire CRM into the "Workshop Bench" premium design standard by applying the impeccable pipeline to all pages, modals, and components.

**Architecture:** We will systematically apply `impeccable` commands (audit, layout, typeset, colorize, delight, polish) across 4 major zones: Dashboard, Point of Sale (POS), CRM (Customers/Partners), and Operations (Repairs/Inventory). We will standardise typography (Readex Pro), replace any lingering UI anti-patterns, enforce strict contrast rules, and add purposeful micro-interactions.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Framer Motion, TypeScript

---

### Task 1: Dashboard Redesign (Audit & Shape)

**Files:**
- Modify: `src/app/admin/DashboardClient.tsx`
- Modify: `src/components/dashboard/Widgets.tsx`

**Step 1: Write the failing test**

```bash
# Verify baseline build succeeds
npm run build
```

**Step 2: Run test to verify it fails (or establishes baseline)**

Run: `npm run build`
Expected: PASS

**Step 3: Write minimal implementation (Impeccable: Layout & Typeset)**

```tsx
// src/app/admin/DashboardClient.tsx
// Goal: Remove remaining hardcoded borders, add proper spacing rhythm
// - Replace `gap-5` with explicit responsive rhythm `gap-4 md:gap-6`
// - Ensure headings use `text-wrap: balance` and tight letter-spacing
// - Add `hover:scale-[1.01]` instead of heavy scale jumps
```

**Step 4: Run test to verify UI renders without build errors**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/admin/DashboardClient.tsx src/components/dashboard/Widgets.tsx
git commit -m "style(dashboard): apply impeccable layout and typeset to dashboard"
```

---

### Task 2: POS Terminal (Colorize & Quieter)

**Files:**
- Modify: `src/app/admin/sales/pos/POSClient.tsx`
- Modify: `src/components/SaleDetailView.tsx`

**Step 1: Write the failing test**

```bash
npx tsc --noEmit
```

**Step 2: Run test to verify it fails (or passes baseline)**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Write minimal implementation (Impeccable: Quieter & Colorize)**

```tsx
// src/app/admin/sales/pos/POSClient.tsx
// - Replace loud gradients with warm solid surface colors + colored text accents.
// - Convert category pills to solid warm neutrals with `--color-violet` active states.
// - Implement strict data-table layout for POS cart.
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/admin/sales/pos/POSClient.tsx src/components/SaleDetailView.tsx
git commit -m "style(pos): apply impeccable quieter and colorize to POS"
```

---

### Task 3: Repairs & Operations (Harden & Clarify)

**Files:**
- Modify: `src/app/admin/repairs/RepairsClient.tsx`
- Modify: `src/app/admin/repairs/RepairsKanban.tsx`
- Modify: `src/components/RepairDetailView.tsx`

**Step 1: Write the failing test**

```bash
npm run build
```

**Step 2: Run test to verify**

Run: `npm run build`
Expected: PASS

**Step 3: Write minimal implementation (Impeccable: Clarify & Harden)**

```tsx
// src/app/admin/repairs/RepairsKanban.tsx
// - Fix information architecture: make device name bolder, customer name quieter.
// - Add explicit empty states for Kanban columns.
// - Ensure drag-and-drop animation uses ease-out-quint (framer-motion).
```

**Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/admin/repairs/RepairsClient.tsx src/app/admin/repairs/RepairsKanban.tsx src/components/RepairDetailView.tsx
git commit -m "style(repairs): impeccable layout and interactions for repairs"
```

---

### Task 4: Modals & Drawers (Delight & Polish)

**Files:**
- Modify: `src/components/ui/Drawer.tsx`
- Modify: `src/components/PayPurchaseModal.tsx`
- Modify: `src/app/admin/store-launch/components/StageManagerModal.tsx`

**Step 1: Write the failing test**

```bash
npx tsc --noEmit
```

**Step 2: Run test to verify**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Write minimal implementation (Impeccable: Delight & Polish)**

```tsx
// Replace standard `bg-black/40` backdrops with solid `bg-text-primary/40` or warm tints.
// Add fluid micro-interactions (staggered list reveals inside drawers).
// Ensure focus-trap and escape-key handling (Harden).
```

**Step 4: Run test to verify it passes**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/Drawer.tsx src/components/PayPurchaseModal.tsx src/app/admin/store-launch/components/StageManagerModal.tsx
git commit -m "style(modals): apply impeccable polish to all overlays"
```
