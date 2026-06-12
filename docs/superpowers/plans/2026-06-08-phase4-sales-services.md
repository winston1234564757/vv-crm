# Phase 4: Sales + Services Expansion

> **For agentic workers:** Use subagent-driven-development.

**Goal:** Add sale_type, delivery fields, warranty_start, return_reason, monobank ref to sales. Add duration + warranty to services.

---

### Task 1: Migration SQL

**File:** `docs/migrations/004_sales_services_expansion.sql`

```sql
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'retail';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_needed boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_tracking text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS warranty_start date;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS monobank_payment_id text;

ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes int;
ALTER TABLE services ADD COLUMN IF NOT EXISTS warranty_days int DEFAULT 0;
```

---

### Task 2: Update TypeScript Types

**Files:** `src/types/database.ts`

Add to `sales.Row`:
```tsx
sale_type: string | null; delivery_needed: boolean | null; delivery_address: string | null;
delivery_tracking: string | null; warranty_start: string | null; return_reason: string | null;
monobank_payment_id: string | null
```
Same to Insert/Update, optional.

Add to `services.Row`:
```tsx
duration_minutes: number | null; warranty_days: number | null
```
Same to Insert/Update.

---

### Task 3: Update Sales Server Actions

**Files:** `src/lib/actions/sales.ts`

Add to saleSchema:
```ts
sale_type: z.string().optional().default("retail"),
delivery_needed: z.coerce.boolean().optional().default(false),
delivery_address: z.string().nullable().optional(),
delivery_tracking: z.string().nullable().optional(),
warranty_start: z.string().nullable().optional(),
return_reason: z.string().nullable().optional(),
monobank_payment_id: z.string().nullable().optional(),
```

Add to createQuickSale data extraction:
```ts
sale_type: formData.get("sale_type") || "retail",
delivery_needed: formData.get("delivery_needed") === "true",
delivery_address: formData.get("delivery_address") || null,
delivery_tracking: formData.get("delivery_tracking") || null,
warranty_start: formData.get("warranty_start") || null,
return_reason: formData.get("return_reason") || null,
monobank_payment_id: formData.get("monobank_payment_id") || null,
```

Add to sale insert call.

---

### Task 4: Update SaleForm

**Files:** `src/components/forms/SaleForm.tsx`

Add sale_type selector after the category tabs:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label htmlFor="sale_type" className="mb-1.5 block text-xs font-medium text-text-secondary">Тип продажу</label>
    <select id="sale_type" name="sale_type" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-violet">
      <option value="retail">Роздріб</option>
      <option value="wholesale">Опт</option>
      <option value="online">Онлайн</option>
    </select>
  </div>
  <div>
    <label htmlFor="monobank_payment_id" className="mb-1.5 block text-xs font-medium text-text-secondary">ID транзакції Monobank (для картки)</label>
    <input id="monobank_payment_id" name="monobank_payment_id" type="text" placeholder="якщо оплата картою" className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-violet" />
  </div>
</div>
```

Add delivery toggle with fields:
```tsx
<div className="flex items-center gap-2 py-1">
  <input id="delivery_needed" name="delivery_needed" type="checkbox" value="true" className="h-4.5 w-4.5 rounded border-iris/20 text-violet" />
  <label htmlFor="delivery_needed" className="text-sm font-medium text-text-primary cursor-pointer">Потрібна доставка</label>
</div>
```

---

### Task 5: Update ServiceForm

**Files:** `src/components/forms/ServiceForm.tsx`

Add after price field:
```tsx
<div className="grid grid-cols-2 gap-4">
  <Input label="Тривалість (хв)" name="duration_minutes" type="number" placeholder="30" defaultValue={service?.duration_minutes?.toString() ?? ""} />
  <Input label="Гарантія (днів)" name="warranty_days" type="number" placeholder="0" defaultValue={service?.warranty_days?.toString() ?? "0"} />
</div>
```

---

### Task 6: Build

Run: `npx next build`
