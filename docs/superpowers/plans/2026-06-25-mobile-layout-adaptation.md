# Mobile Layout Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Adapt all pages, tables, and modals in the CRM system to be mobile-friendly, responsive, prevent auto-zoom on inputs, and fit comfortably on smaller viewports.

**Architecture:** 
1. **Forms/Inputs**: Change font-size to 16px on mobile viewports for inputs and selects to prevent iOS Safari auto-zooming.
2. **Modals/Drawers**: Convert the global `Drawer` component into a responsive Bottom Sheet on mobile viewports ($<768\text{px}$) with bottom slide-up transitions, a drag handle, and body scroll lock.
3. **Data Tables**: Update all data tables in the CRM (`devices`, `repairs`, `parts`, `accessories`, `sales`, `purchases`, `customers`, `finance`, `suppliers`, `services`) to render a card list stack on mobile instead of horizontal-scroll table rows.
4. **Dashboard Detail Modal**: Adapt `RefurbishmentDetailsModal` tables inside `DashboardClient.tsx` to render mobile-optimized list items instead of table columns.

**Tech Stack:** React, Next.js App Router, Tailwind CSS, Framer Motion

---

### Task 1: Prevent iOS Input Auto-Zoom

Change base inputs and selects to have a font size of 16px (`text-base`) on mobile viewports and scale down to `text-sm` (`14px`) only on desktop screens.

**Files:**
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/SearchSelect.tsx`
- Modify: `src/components/forms/device/DeviceFormMain.tsx`

**Step 1: Modify input field text size in `src/components/ui/Input.tsx`**
- Replace `text-sm` with `text-base md:text-sm` inside the input styling to ensure mobile browsers don't auto-zoom.

**Step 2: Modify text sizes in `src/components/ui/SearchSelect.tsx`**
- Change trigger text size from `text-sm` to `text-base md:text-sm`.
- Change search input text size from `text-xs` to `text-base md:text-sm` to prevent zoom on dropdown search activation.

**Step 3: Modify native `<select>` elements in forms**
- Replace `text-sm` with `text-base md:text-sm` in `src/components/forms/device/DeviceFormMain.tsx`.

---

### Task 2: Responsive Modal and Drawer (Bottom Sheets)

Adapt `src/components/ui/Drawer.tsx` to act as a bottom sheet (slide up from bottom) instead of a right drawer on mobile screens.

**Files:**
- Modify: `src/components/ui/Drawer.tsx`

**Step 1: Modify Drawer animations and layout**
- Detect screen width or use media queries. Change layout styling:
  - On desktop (`md:`): slide in from the right (`x: "100%"` to `0`).
  - On mobile: slide up from the bottom (`y: "100%"` to `0`), apply top rounded corners `rounded-t-3xl`, and place a visual drag handle at the top (`w-12 h-1 bg-slate-300 rounded-full mx-auto mb-4`).
- Modify Framer Motion configs in `Drawer.tsx` to handle responsive directions dynamically.

---

### Task 3: Mobile Card Grid Layout for Core Tables

Create a responsive layout pattern where tables display as standard tables on desktop (`hidden md:table`), but transform into a vertical card grid list (`grid grid-cols-1 gap-3 md:hidden`) on mobile.

**Files:**
- Modify: `src/app/admin/devices/table.tsx`
- Modify: `src/app/admin/repairs/table.tsx`
- Modify: `src/app/admin/sales/table.tsx`
- Modify: `src/app/admin/customers/table.tsx`
- Modify: `src/app/admin/parts/table.tsx`
- Modify: `src/app/admin/accessories/table.tsx`
- Modify: `src/app/admin/suppliers/table.tsx`
- Modify: `src/app/admin/services/table.tsx`
- Modify: `src/app/admin/purchases/table.tsx`
- Modify: `src/app/admin/finance/FinanceTransactionsTable.tsx`

**Step 1: Update Devices Archive Table in `src/app/admin/devices/table.tsx`**
- Restructure table body rendering to render a grid of mobile cards on mobile.

**Step 2: Update Repairs Table in `src/app/admin/repairs/table.tsx`**
- Render a list of cards on mobile under `viewMode === "table"`.

**Step 3: Update Sales, Customers, Parts and other tables**
- Add mobile card representation displaying key columns stacked.

---

### Task 4: Adapt Dashboard Modal Tables

Adapt the refurbishment aggregation modal's tables to list cards on mobile viewports.

**Files:**
- Modify: `src/app/admin/DashboardClient.tsx`

**Step 1: Restructure tables in `RefurbishmentDetailsModal`**
- On mobile (`block md:hidden`), render a card list instead of `overflow-x-auto` table.

---

### Task 5: Build and Verification

**Step 1: Compile TS checking for any errors**
Run: `npx tsc --noEmit`
Expected: Success with no errors.

**Step 2: Verify responsive behavior**
Run: Use devtools to simulate mobile viewport.
Expected: Zero horizontal scrolls on the page body, 48px touch targets, bottom-sheet styled modals, and fully legible card layouts instead of compressed tables.
