# Phase 2: Devices + Accessories Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add source tracking, condition grading, and warehouse fields to devices and accessories.

**Architecture:** New fields in DB → update TypeScript types → update Zod schemas in server actions → update forms → update tables.

**Tech Stack:** Next.js 16, Supabase, Zod, Tailwind v4

---

### Task 1: Database Migration — Add Columns (SQL to run in Supabase)

**Files:**
- Create: `docs/migrations/002_devices_accessories_expansion.sql`

- [ ] **Step 1: Create migration SQL file**

Write `docs/migrations/002_devices_accessories_expansion.sql`:

```sql
-- Devices: new columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS source text DEFAULT 'supplier';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS purchased_from text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS condition_grade text DEFAULT 'good';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS condition_description text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS original_box boolean DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS accessories_included text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS warehouse_location text;

-- Accessories: new columns
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS source text DEFAULT 'supplier';
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE accessories ADD COLUMN IF NOT EXISTS warehouse_location text;

-- Rename existing devices.source if it conflicts (it doesn't currently exist)
```

- [ ] **Step 2: Run migration in Supabase SQL editor**

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Update devices type (Row)**

Add to `devices.Row`:
```
source: string | null
source_reference: string | null
purchased_from: string | null
condition_grade: string | null
condition_description: string | null
original_box: boolean | null
accessories_included: string | null
serial_number: string | null
warehouse_location: string | null
```

- [ ] **Step 2: Update devices Insert/Update**
Same fields, optional.

- [ ] **Step 3: Update accessories type (Row)**

Add:
```
source: string | null
barcode: string | null
warehouse_location: string | null
```

---

### Task 3: Update Device Server Actions

**Files:**
- Modify: `src/lib/actions/inventory.ts`

- [ ] **Step 1: Add new fields to deviceSchema**

Add to Zod schema:
```ts
source: z.string().optional().default("supplier"),
source_reference: z.string().nullable().optional(),
purchased_from: z.string().nullable().optional(),
condition_grade: z.string().optional().default("good"),
condition_description: z.string().nullable().optional(),
original_box: z.coerce.boolean().optional().default(false),
accessories_included: z.string().nullable().optional(),
serial_number: z.string().nullable().optional(),
warehouse_location: z.string().nullable().optional(),
```

- [ ] **Step 2: Update createDevice — extract new fields from FormData**

```ts
source: formData.get("source") || "supplier",
source_reference: formData.get("source_reference") || null,
purchased_from: formData.get("purchased_from") || null,
condition_grade: formData.get("condition_grade") || "good",
condition_description: formData.get("condition_description") || null,
original_box: formData.get("original_box") === "true",
accessories_included: formData.get("accessories_included") || null,
serial_number: formData.get("serial_number") || null,
warehouse_location: formData.get("warehouse_location") || null,
```

- [ ] **Step 3: Update insert call with new fields**

- [ ] **Step 4: Update updateDevice with same new fields**

---

### Task 4: Update Accessory Server Actions

**Files:**
- Modify: `src/lib/actions/inventory.ts`

- [ ] **Step 1: Add fields to accessorySchema**

```ts
source: z.string().optional().default("supplier"),
barcode: z.string().nullable().optional(),
warehouse_location: z.string().nullable().optional(),
```

- [ ] **Step 2: Update createAccessory — extract new fields**

```ts
source: formData.get("source") || "supplier",
barcode: formData.get("barcode") || null,
warehouse_location: formData.get("warehouse_location") || null,
```

- [ ] **Step 3: Update updateAccessory with same fields**

---

### Task 5: Update DeviceForm

**Files:**
- Modify: `src/components/forms/DeviceForm.tsx`

- [ ] **Step 1: Add Source field group after model/type section**

```tsx
<div className="border-t border-warm-border/50 pt-4">
  <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Джерело надходження</h3>
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Звідки пристрій</label>
      <select name="source" defaultValue={device?.source ?? "supplier"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40">
        <option value="supplier">Постачальник</option>
        <option value="trade_in">Trade-In</option>
        <option value="buyout">Викуп</option>
        <option value="olx">OLX</option>
        <option value="marketplace">Маркетплейс</option>
        <option value="customer_return">Повернення клієнта</option>
        <option value="other">Інше</option>
      </select>
    </div>
    <Input label="Посилання / № оголошення" name="source_reference" placeholder="https://olx.ua/..." defaultValue={device?.source_reference ?? ""} />
    <Input label="Куплено у (кого)" name="purchased_from" placeholder="ПІБ або постачальник" defaultValue={device?.purchased_from ?? ""} />
  </div>
</div>
```

- [ ] **Step 2: Add Condition field group before repair section**

```tsx
<div className="border-t border-warm-border/50 pt-4">
  <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Стан пристрою</h3>
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Грейд</label>
      <select name="condition_grade" defaultValue={device?.condition_grade ?? "good"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40">
        <option value="new">Новий</option>
        <option value="like_new">Як новий</option>
        <option value="good">Добрий</option>
        <option value="fair">Задовільний</option>
        <option value="poor">Поганий</option>
      </select>
    </div>
    <div className="md:col-span-2">
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Опис стану</label>
      <input name="condition_description" defaultValue={device?.condition_description ?? ""} placeholder="Подряпини, сліди використання..." className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
    </div>
  </div>
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" name="original_box" value="true" defaultChecked={device?.original_box ?? false} className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" />
      <span className="text-sm font-medium text-text-primary">В оригінальній коробці</span>
    </label>
    <Input label="Комплектація" name="accessories_included" placeholder="Зарядка, кабель..." defaultValue={device?.accessories_included ?? ""} />
    <Input label="Серійний номер (S/N)" name="serial_number" placeholder="F2LZ..." defaultValue={device?.serial_number ?? ""} />
  </div>
</div>
```

- [ ] **Step 3: Add Warehouse field**

```tsx
<Input label="Розташування на складі" name="warehouse_location" placeholder="Стелаж А, полиця 3" defaultValue={device?.warehouse_location ?? ""} />
```

---

### Task 6: Update AccessoryForm

**Files:**
- Modify: `src/components/forms/AccessoryForm.tsx`

- [ ] **Step 1: Add Source + Warehouse fields after description section**

```tsx
<div className="border-t border-warm-border/50 pt-4 space-y-4">
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Джерело</label>
      <select name="source" defaultValue={accessory?.source ?? "supplier"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40">
        <option value="supplier">Постачальник</option>
        <option value="trade_in">Trade-In</option>
        <option value="buyout">Викуп</option>
        <option value="olx">OLX</option>
        <option value="other">Інше</option>
      </select>
    </div>
    <Input label="Штрих-код (EAN)" name="barcode" placeholder="4820000000000" defaultValue={accessory?.barcode ?? ""} />
    <Input label="Розташування на складі" name="warehouse_location" placeholder="Стелаж Б, полиця 1" defaultValue={accessory?.warehouse_location ?? ""} />
  </div>
</div>
```

---

### Task 7: Update DevicesTable

**Files:**
- Modify: `src/app/admin/devices/table.tsx`

- [ ] **Step 1: Add Source + Condition columns to table**

Add after the "Характеристики" column:
```tsx
<th className="pb-2 pr-4">Джерело</th>
<th className="pb-2 pr-4">Стан</th>
```

- [ ] **Step 2: Add data cells**

After the specs td:
```tsx
<td className="py-3 pr-4 text-xs text-text-secondary">
  {sourceLabels[d.source] || d.source || "—"}
</td>
<td className="py-3 pr-4 text-xs">
  <span className={`rounded px-2 py-0.5 font-medium ${conditionColors[d.condition_grade]}`}>
    {conditionLabels[d.condition_grade] || "—"}
  </span>
</td>
```

- [ ] **Step 3: Update DeviceRow type and add labels maps**

```tsx
const sourceLabels: Record<string, string> = {
  supplier: "Постачальник", trade_in: "Trade-In", buyout: "Викуп",
  olx: "OLX", marketplace: "Маркетплейс", customer_return: "Повернення", other: "Інше",
};
const conditionLabels: Record<string, string> = {
  new: "Новий", like_new: "Як новий", good: "Добрий", fair: "Задовільний", poor: "Поганий",
};
const conditionColors: Record<string, string> = {
  new: "text-cyan bg-cyan/10", like_new: "text-cyan bg-cyan/10",
  good: "text-violet bg-violet/10", fair: "text-amber bg-amber/10", poor: "text-rose bg-rose/10",
};
```

---

### Task 8: Build & Verify

**Files:**
- Run: build

- [ ] **Step 1: Build**

Run: `npx next build`
Expected: ✓ Compiled successfully, no TS errors.
