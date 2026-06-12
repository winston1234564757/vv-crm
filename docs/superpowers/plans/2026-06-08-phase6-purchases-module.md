# Phase 6: Purchases Module

**Goal:** Full CRUD for purchases with purchase_items, stock updates, supplier integration.

---

### Task 1: Server Actions

**File:** `src/lib/actions/purchases.ts`

Create:
- `createPurchase(prevState, formData)` — inserts into purchases + purchase_items, updates parts/accessories stock
- `updatePurchase(id, prevState, formData)` — updates purchase status (received/paid)
- `deletePurchase(id)` — soft delete/cancel

Schema:
```ts
purchaseSchema = z.object({
  supplier_id: z.string().nullable().optional(),
  total_amount: z.coerce.number().min(0),
  status: z.string().optional().default("pending"),
  paid_from_safe_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.string(), // JSON string of items array
})
```

### Task 2: Data Fetching

**File:** `src/lib/data-purchases.ts`

```ts
export async function getPurchases() -> full purchase data with items
export async function getPurchaseItems(purchaseId) -> items with joined names
```

### Task 3: Page + Table + Form

**Files:**
- `src/app/admin/purchases/page.tsx`
- `src/app/admin/purchases/table.tsx`
- `src/app/admin/purchases/AddPurchaseButton.tsx`
- `src/app/admin/purchases/loading.tsx`
- `src/components/forms/PurchaseForm.tsx`

Follow the same patterns as suppliers/parts pages.

### Task 4: Sidebar

Add "Закупівлі" link to sidebar.

### Task 5: Build

Run: `npx next build`
