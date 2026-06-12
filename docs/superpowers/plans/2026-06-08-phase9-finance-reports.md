# Phase 9: Finance Reports

**Goal:** Add profit/loss summary, period filtering, CSV export to finance page.

---

### Task 1: Profit/Loss Data

**File:** `src/lib/data.ts` — add `getFinanceReport()`

Returns:
- Total sales (all time)
- Total purchases (all time)
- Total expenses (all time)
- Profit = sales - purchases - expenses
- Expenses by category (from expense_categories)
- Sales by type (device vs accessory vs repair)

### Task 2: Update Finance Page

**File:** `src/app/admin/finance/page.tsx`

Add profit/loss cards block between totals and cash registers:
- Income (total sales)
- Expenses (purchases + expenses)
- Profit (income - expenses)

Add date range filter + CSV export button for transactions.

### Task 3: Build

`npx next build`
