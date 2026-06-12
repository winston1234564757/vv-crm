# Phase 5: Customers Expansion

**Goal:** Add vip_status, tags, preferred_contact, source, social links, orders stats, communication log.

---

### Task 1: Migration SQL

**File:** `docs/migrations/005_customers_expansion.sql`

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_status text DEFAULT 'regular';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'phone';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source text DEFAULT 'walk_in';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS social_links jsonb;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_total int DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS orders_completed int DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visit timestamptz;
```

---

### Task 2: Update TypeScript Types

**File:** `src/types/database.ts`

Add to customers Row/Insert/Update:
```ts
vip_status: string | null; tags: string[] | null; preferred_contact: string | null;
source: string | null; social_links: Json | null; orders_total: number | null;
orders_completed: number | null; last_visit: string | null
```

---

### Task 3: Update Customer Server Actions

**File:** `src/lib/actions/customers.ts`

Add to customerSchema:
```ts
vip_status: z.string().optional().default("regular"),
tags: z.string().optional(),
preferred_contact: z.string().optional().default("phone"),
source: z.string().optional().default("walk_in"),
social_links: z.string().nullable().optional(),
orders_total: z.coerce.number().optional().default(0),
orders_completed: z.coerce.number().optional().default(0),
last_visit: z.string().nullable().optional(),
```

Add to createCustomer and updateCustomer:
```ts
vip_status: formData.get("vip_status") || "regular",
tags: tagsArray,  // split tag string by comma
preferred_contact: formData.get("preferred_contact") || "phone",
source: formData.get("source") || "walk_in",
social_links: formData.get("social_links") || null,
orders_total: Number(formData.get("orders_total")) || 0,
orders_completed: Number(formData.get("orders_completed")) || 0,
last_visit: formData.get("last_visit") || null,
```

---

### Task 4: Update CustomerForm

**File:** `src/components/forms/CustomerForm.tsx`

Add vip_status + source grid after name/phone block:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label>VIP Статус</label>
    <select name="vip_status">
      <option value="regular">Звичайний</option>
      <option value="silver">Срібний</option>
      <option value="gold">Золотий</option>
      <option value="platinum">Платінум</option>
    </select>
  </div>
  <div>
    <label>Звідки прийшов</label>
    <select name="source">
      <option value="walk_in">Візит</option>
      <option value="referral">Рекомендація</option>
      <option value="social">Соцмережі</option>
      <option value="online">Онлайн</option>
    </select>
  </div>
</div>
```

Add tags, preferred_contact. Keep existing fields.

---

### Task 5: Update CustomersTable

**File:** `src/app/admin/customers/table.tsx`

Add VIP status column with colored badge.

---

### Task 6: Build

Run: `npx next build`
