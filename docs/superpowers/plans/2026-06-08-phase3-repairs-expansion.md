# Phase 3: Repairs Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Expand repairs with device condition (photos required), source tracking, payment status, communication log, and tech notes.

**Architecture:** DB migration → types → server actions → RepairForm (new) → EditRepairForm → repairs table → track page

---

### Task 1: Database Migration

**Files:**
- Create: `docs/migrations/003_repairs_expansion.sql`

```sql
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_password text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_accessories_included text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS source text DEFAULT 'walk_in';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition_description text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS device_condition_photos text[] DEFAULT '{}';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_completion timestamptz;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS diagnosis_result text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS technician_notes_internal text;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS customer_communication_log jsonb DEFAULT '[]'::jsonb;

ALTER TABLE repair_status_log ADD COLUMN IF NOT EXISTS is_customer_visible boolean DEFAULT true;
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

Add to `repairs.Row`:
```
device_password: string | null
device_accessories_included: string | null
source: string | null
device_condition: string | null
device_condition_description: string | null
device_condition_photos: string[]
estimated_completion: string | null
payment_status: string | null
diagnosis_result: string | null
technician_notes_internal: string | null
customer_communication_log: any
```

Add to `repairs.Insert/Update`: same fields optional.

Add to `repair_status_log.Row`:
```
is_customer_visible: boolean
```

---

### Task 3: Update Server Actions (`src/lib/actions/repairs.ts`)

**repairSchema** — add:
```ts
source: z.string().optional().default("walk_in"),
device_password: z.string().nullable().optional(),
device_accessories_included: z.string().nullable().optional(),
device_condition: z.string().nullable().optional(),
device_condition_description: z.string().nullable().optional(),
estimated_completion: z.string().nullable().optional(),
```

**createRepair** — extract new fields from FormData:
```ts
source: formData.get("source") || "walk_in",
device_password: formData.get("device_password") || null,
device_accessories_included: formData.get("device_accessories_included") || null,
device_condition: formData.get("device_condition") || null,
device_condition_description: formData.get("device_condition_description") || null,
estimated_completion: formData.get("estimated_completion") || null,
```

Add to insert call.

**editRepairSchema** — add:
```ts
payment_status: z.string().optional().default("unpaid"),
diagnosis_result: z.string().nullable().optional(),
technician_notes_internal: z.string().nullable().optional(),
customer_communication_log: z.any().optional(),
```

**updateRepair** — extract and include in update call.

---

### Task 4: Update RepairForm (create)

**Files:**
- Modify: `src/components/forms/RepairForm.tsx`

Add after device_imei field:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label htmlFor="source" className="mb-1.5 block text-xs font-medium text-text-secondary">Звідки звернувся</label>
    <select id="source" name="source" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet">
      <option value="walk_in">Прийшов у магазин</option>
      <option value="phone">Зателефонував</option>
      <option value="online">Онлайн (сайт/месенджер)</option>
      <option value="marketplace">Маркетплейс</option>
    </select>
  </div>
  <div>
    <label htmlFor="estimated_completion" className="mb-1.5 block text-xs font-medium text-text-secondary">Орієнтовна дата готовності</label>
    <input id="estimated_completion" name="estimated_completion" type="date" className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" />
  </div>
</div>
```

Add device password + accessories after device_name:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label htmlFor="device_password" className="mb-1.5 block text-xs font-medium text-text-secondary">Пароль пристрою (якщо є)</label>
    <input id="device_password" name="device_password" type="text" placeholder="Код блокування, пароль iCloud..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
  </div>
  <div>
    <label htmlFor="device_accessories_included" className="mb-1.5 block text-xs font-medium text-text-secondary">Комплектація (що здав клієнт)</label>
    <input id="device_accessories_included" name="device_accessories_included" type="text" placeholder="Зарядка, чохол, коробка..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
  </div>
</div>
```

Add device condition section before notes:
```tsx
<div className="border-t border-warm-border/50 pt-4">
  <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Стан пристрою на момент здачі</h3>
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <label htmlFor="device_condition" className="mb-1.5 block text-xs font-medium text-text-secondary">Грейд стану *</label>
      <select id="device_condition" name="device_condition" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet">
        <option value="">Оберіть стан...</option>
        <option value="new">Новий</option>
        <option value="like_new">Як новий</option>
        <option value="good">Добрий</option>
        <option value="fair">Задовільний</option>
        <option value="poor">Поганий</option>
      </select>
    </div>
    <div>
      <label htmlFor="device_condition_description" className="mb-1.5 block text-xs font-medium text-text-secondary">Опис стану</label>
      <input id="device_condition_description" name="device_condition_description" placeholder="Подряпин на дисплеї..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
    </div>
  </div>
  <div className="mt-4">
    <label className="mb-1.5 block text-xs font-medium text-text-secondary">Фото стану пристрою *</label>
    <p className="text-xs text-text-secondary mb-2">Додайте фото пристрою на момент приймання (обов'язково)</p>
    <input type="file" name="device_condition_photos" multiple accept="image/*" required className="w-full text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-violet file:px-3 file:py-2 file:text-xs file:font-medium file:text-white" />
  </div>
</div>
```

---

### Task 5: Update EditRepairForm

**Files:**
- Modify: `src/components/forms/EditRepairForm.tsx`

Add fields to the form:
- `payment_status` — select: unpaid/paid/partial
- `diagnosis_result` — textarea
- `technician_notes_internal` — textarea with label "Нотатки майстра (не показувати клієнту)"

Add payment_status field after status select:
```tsx
<div>
  <label htmlFor="payment_status" className="mb-1.5 block text-xs font-medium text-text-secondary">Статус оплати</label>
  <select id="payment_status" name="payment_status" defaultValue={repair.payment_status ?? "unpaid"} className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet">
    <option value="unpaid">Не оплачено</option>
    <option value="paid">Оплачено</option>
    <option value="partial">Частково</option>
  </select>
</div>
```

Add two new textareas after existing notes:
```tsx
<div>
  <label htmlFor="diagnosis_result" className="mb-1.5 block text-xs font-medium text-text-secondary">Результат діагностики</label>
  <textarea id="diagnosis_result" name="diagnosis_result" rows={2} defaultValue={repair.diagnosis_result ?? ""} placeholder="Висновки після діагностики..." className="w-full resize-none rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
</div>
<div>
  <label htmlFor="technician_notes_internal" className="mb-1.5 block text-xs font-medium text-text-secondary">Нотатки майстра (внутрішні)</label>
  <textarea id="technician_notes_internal" name="technician_notes_internal" rows={2} defaultValue={repair.technician_notes_internal ?? ""} placeholder="Не показується клієнту в трекінгу..." className="w-full resize-none rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 text-sm text-text-primary outline-none focus:border-amber" />
</div>
```

Also add `data_was: any()` to the RepairData interface (line 7-25).

---

### Task 6: Update RepairsTable

**Files:**
- Modify: `src/app/admin/repairs/table.tsx`

Add columns for Source, Condition, Payment Status after the Status column.

```tsx
// In header:
<th className="pb-2 pr-4">Джерело</th>
<th className="pb-2 pr-4">Стан</th>
<th className="pb-2 pr-4">Оплата</th>

// Data cells:
<td className="py-3 pr-4 text-xs text-text-secondary">{r.source || "—"}</td>
<td className="py-3 pr-4 text-xs">{r.device_condition || "—"}</td>
<td className="py-3 pr-4 text-xs">
  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${paymentColors[r.payment_status]}`}>
    {paymentLabels[r.payment_status] || "—"}
  </span>
</td>
```

Add label maps:
```tsx
const paymentLabels: Record<string, string> = { unpaid: "Не оплачено", paid: "Оплачено", partial: "Частково" };
const paymentColors: Record<string, string> = { unpaid: "text-rose bg-rose/10", paid: "text-cyan bg-cyan/10", partial: "text-amber bg-amber/10" };
```

---

### Task 7: Build & Verify

Run: `npx next build`
Expected: ✓ Compiled successfully
