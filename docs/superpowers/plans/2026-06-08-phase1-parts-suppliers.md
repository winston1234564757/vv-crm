# Phase 1: Parts Warehouse + Suppliers Module Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Create full CRUD modules for `suppliers` and `parts` with warehouse movement tracking.

**Architecture:** New modules follow existing admin patterns: Server Component page + client table + drawer form + server actions. Parts movements use existing `inventory_movements` table.

**Tech Stack:** Next.js 16, Supabase (admin client), Zod, Tailwind v4

**Depends on:** Nothing — fully independent phase

---

### Task 1: Update Database Types (`src/types/database.ts`)

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Verify current `suppliers` table shape in database.ts matches actual DB**

Run: look at lines 21-25 of database.ts — suppliers table exists with: id, name, contact_person, phone, email, notes, created_at, updated_at. All good.

- [ ] **Step 2: Verify `parts` table shape**

Look at lines 45-49 — parts table exists with: id, name, part_number, type, compatible_with, cost_price, price, stock, min_stock, supplier_id, created_at, updated_at. All good.

No type changes needed — types match DB.

---

### Task 2: Create Suppliers Data Layer

**Files:**
- Create: `src/lib/actions/suppliers.ts`
- Create: `src/lib/data-suppliers.ts`

- [ ] **Step 1: Create server actions for suppliers**

Write `src/lib/actions/suppliers.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseError } from "@/lib/utils/errors";

const supplierSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  contact_person: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createSupplier(prevState: any, formData: FormData) {
  try {
    const data = {
      name: formData.get("name"),
      contact_person: formData.get("contact_person") || null,
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      notes: formData.get("notes") || null,
    };
    const parsed = supplierSchema.parse(data);
    const supabase = createAdminClient();
    const { error } = await supabase.from("suppliers").insert(parsed);
    if (error) throw error;
    revalidatePath("/admin/suppliers");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updateSupplier(id: string, prevState: any, formData: FormData) {
  try {
    const data = {
      name: formData.get("name"),
      contact_person: formData.get("contact_person") || null,
      phone: formData.get("phone") || null,
      email: formData.get("email") || null,
      notes: formData.get("notes") || null,
    };
    const parsed = supplierSchema.parse(data);
    const supabase = createAdminClient();
    const { error } = await supabase.from("suppliers").update(parsed).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/suppliers");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deleteSupplier(id: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/suppliers");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
```

- [ ] **Step 2: Create data fetching for suppliers**

Write `src/lib/data-suppliers.ts`:

```ts
import { createAdminClient } from "./supabase/admin";

export async function getSuppliers() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getSupplierParts(supplierId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .eq("supplier_id", supplierId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}
```

---

### Task 3: Create Suppliers UI

**Files:**
- Create: `src/app/admin/suppliers/page.tsx`
- Create: `src/app/admin/suppliers/table.tsx`
- Create: `src/app/admin/suppliers/AddSupplierButton.tsx`
- Create: `src/components/forms/SupplierForm.tsx`

- [ ] **Step 1: Create Supplier form**

Write `src/components/forms/SupplierForm.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

export function SupplierForm({ onSuccess, supplier }: {
  onSuccess: () => void;
  supplier?: { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; notes: string | null }
}) {
  const action = supplier ? updateSupplier.bind(null, supplier.id) : createSupplier;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4 p-2">
      {state.error && <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>}
      <Input label="Назва постачальника" name="name" required placeholder="ТОВ \"Електроніка\"" defaultValue={supplier?.name ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Контактна особа" name="contact_person" placeholder="Олександр" defaultValue={supplier?.contact_person ?? ""} />
        <Input label="Телефон" name="phone" placeholder="+380991234567" defaultValue={supplier?.phone ?? ""} />
      </div>
      <Input label="Email" name="email" type="email" placeholder="post@example.com" defaultValue={supplier?.email ?? ""} />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки</label>
        <textarea name="notes" rows={2} defaultValue={supplier?.notes ?? ""} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" placeholder="Умови співпраці, доставка..." />
      </div>
      <button type="submit" disabled={pending} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50">
        {pending ? "Збереження..." : supplier ? "Зберегти зміни" : "Додати постачальника"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create AddSupplierButton**

Write `src/app/admin/suppliers/AddSupplierButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { SupplierForm } from "@/components/forms/SupplierForm";

export function AddSupplierButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
        <IconPlus /> Постачальник
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Новий постачальник">
        <SupplierForm onSuccess={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
```

- [ ] **Step 3: Create Suppliers table**

Write `src/app/admin/suppliers/table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete } from "@/components/icons";
import { deleteSupplier } from "@/lib/actions/suppliers";
import Drawer from "@/components/ui/Drawer";
import { SupplierForm } from "@/components/forms/SupplierForm";

type SupplierRow = { id: string; name: string; contact_person: string | null; phone: string | null; email: string | null; notes: string | null };

export function SuppliersTable({ suppliers }: { suppliers: SupplierRow[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any>(null);

  async function handleDelete(id: string) {
    if (!confirm("Видалити постачальника?")) return;
    const res = await deleteSupplier(id);
    if (!res.success) alert(res.error);
  }

  const filtered = suppliers.filter(s => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.contact_person ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q);
  });

  return (
    <>
      <div className="flex items-center max-w-xs relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук постачальника..." className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Назва</th>
              <th className="pb-2 pr-4">Контакт</th>
              <th className="pb-2 pr-4">Телефон</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4 max-w-[200px]">Примітки</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                  <td className="py-3 pr-4 font-medium">{s.name}</td>
                  <td className="py-3 pr-4 text-text-secondary">{s.contact_person || "—"}</td>
                  <td className="py-3 pr-4 text-text-secondary">{s.phone || "—"}</td>
                  <td className="py-3 pr-4 text-text-secondary">{s.email || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-secondary truncate max-w-[200px]">{s.notes || "—"}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(s)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"><IconEdit /></button>
                      <button onClick={() => handleDelete(s.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"><IconDelete /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Drawer isOpen={!!editing} onClose={() => setEditing(null)} title="Редагувати постачальника">
        {editing && <SupplierForm onSuccess={() => setEditing(null)} supplier={editing} />}
      </Drawer>
    </>
  );
}
```

- [ ] **Step 4: Create Suppliers page**

Write `src/app/admin/suppliers/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

import { getSuppliers } from "@/lib/data-suppliers";
import { SuppliersTable } from "./table";
import { AddSupplierButton } from "./AddSupplierButton";
import { pluralUk } from "@/lib/utils/plural";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Постачальники</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{suppliers.length} {pluralUk(suppliers.length, "постачальник", "постачальники", "постачальників")}</p>
        </div>
        <AddSupplierButton />
      </div>
      <GlassCard>
        <SuppliersTable suppliers={suppliers} />
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 5: Add sidebar link for suppliers**

Modify `src/components/AdminSidebar.tsx` — add Suppliers link after Services.

Find the existing nav links and add:
```tsx
{ href: "/admin/suppliers", label: "Постачальники", icon: "suppliers" }
```

Check if there's an icon for "suppliers" in `src/components/icons.tsx`. If not, use a generic one or add a simple SVG.

---

### Task 4: Create Parts Data Layer

**Files:**
- Create: `src/lib/actions/parts.ts`
- Create: `src/lib/data-parts.ts`

- [ ] **Step 1: Create server actions for parts**

Write `src/lib/actions/parts.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseError } from "@/lib/utils/errors";

const partSchema = z.object({
  name: z.string().min(1, "Назва обов'язкова"),
  part_number: z.string().nullable().optional(),
  type: z.string().min(1, "Тип обов'язковий"),
  compatible_with: z.string().nullable().optional(),
  cost_price: z.coerce.number().min(0),
  price: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().min(0),
  min_stock: z.coerce.number().min(0).default(3),
  supplier_id: z.string().uuid().nullable().optional(),
});

export async function createPart(prevState: any, formData: FormData) {
  try {
    const data = {
      name: formData.get("name"),
      part_number: formData.get("part_number") || null,
      type: formData.get("type"),
      compatible_with: formData.get("compatible_with") || null,
      cost_price: formData.get("cost_price"),
      price: formData.get("price") || null,
      stock: formData.get("stock"),
      min_stock: formData.get("min_stock") || 3,
      supplier_id: formData.get("supplier_id") || null,
    };
    const parsed = partSchema.parse(data);
    const supabase = createAdminClient();
    const { error } = await supabase.from("parts").insert(parsed);
    if (error) throw error;
    revalidatePath("/admin/parts");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function updatePart(id: string, prevState: any, formData: FormData) {
  try {
    const data = {
      name: formData.get("name"),
      part_number: formData.get("part_number") || null,
      type: formData.get("type"),
      compatible_with: formData.get("compatible_with") || null,
      cost_price: formData.get("cost_price"),
      price: formData.get("price") || null,
      stock: formData.get("stock"),
      min_stock: formData.get("min_stock") || 3,
      supplier_id: formData.get("supplier_id") || null,
    };
    const parsed = partSchema.parse(data);
    const supabase = createAdminClient();
    const { error } = await supabase.from("parts").update(parsed).eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/parts");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function deletePart(id: string) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) throw error;
    revalidatePath("/admin/parts");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

export async function adjustPartStock(partId: string, quantityChange: number, reason: string, referenceId?: string) {
  try {
    const supabase = createAdminClient();
    const { data: part } = await supabase.from("parts").select("stock").eq("id", partId).single();
    if (!part) throw new Error("Деталь не знайдено");
    const newStock = Math.max(0, part.stock + quantityChange);
    await supabase.from("parts").update({ stock: newStock }).eq("id", partId);
    await supabase.from("inventory_movements").insert({
      item_type: "part",
      item_id: partId,
      quantity_change: quantityChange,
      reason,
      reference_id: referenceId,
    });
    revalidatePath("/admin/parts");
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}
```

- [ ] **Step 2: Create data fetching for parts**

Write `src/lib/data-parts.ts`:

```ts
import { createAdminClient } from "./supabase/admin";

export async function getParts() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("parts")
    .select("*, suppliers(name)")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, supplier_name: p.suppliers?.name ?? "—" }));
}

export async function getPartsAlerts() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("parts").select("name, stock, min_stock").lte("stock", "min_stock");
  if (error) throw error;
  return (data ?? []).map(p => ({ item: p.name, stock: p.stock, urgent: p.stock === 0 }));
}
```

---

### Task 5: Create Parts UI

**Files:**
- Create: `src/app/admin/parts/page.tsx`
- Create: `src/app/admin/parts/table.tsx`
- Create: `src/app/admin/parts/AddPartButton.tsx`
- Create: `src/components/forms/PartForm.tsx`

- [ ] **Step 1: Create Part form**

Write `src/components/forms/PartForm.tsx`:

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { createPart, updatePart } from "@/lib/actions/parts";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

export function PartForm({ onSuccess, part, suppliers }: {
  onSuccess: () => void;
  part?: any;
  suppliers: { id: string; name: string }[];
}) {
  const action = part ? updatePart.bind(null, part.id) : createPart;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4 p-2">
      {state.error && <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>}
      <Input label="Назва деталі" name="name" required placeholder="Display iPhone 13" defaultValue={part?.name ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Part Number" name="part_number" placeholder="LP134-1" defaultValue={part?.part_number ?? ""} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Тип</label>
          <select name="type" required defaultValue={part?.type ?? "screen"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40">
            <option value="screen">Екран</option>
            <option value="battery">Акумулятор</option>
            <option value="charging_port">Порт зарядки</option>
            <option value="cable">Шлейф</option>
            <option value="button">Кнопка</option>
            <option value="camera">Камера</option>
            <option value="speaker">Динамік</option>
            <option value="other">Інше</option>
          </select>
        </div>
      </div>
      <Input label="Сумісність (моделі)" name="compatible_with" placeholder="iPhone 13, 14, 15..." defaultValue={part?.compatible_with ?? ""} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Собівартість (грн)" name="cost_price" type="number" required placeholder="500" defaultValue={part?.cost_price.toString() ?? ""} />
        <Input label="Ціна продажу (грн)" name="price" type="number" placeholder="800" defaultValue={part?.price?.toString() ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="На складі (шт)" name="stock" type="number" required placeholder="5" defaultValue={part?.stock.toString() ?? "0"} />
        <Input label="Мін. залишок" name="min_stock" type="number" placeholder="3" defaultValue={part?.min_stock.toString() ?? "3"} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Постачальник</label>
        <select name="supplier_id" defaultValue={part?.supplier_id ?? ""} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40">
          <option value="">Не вказано</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-press mt-4 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50">
        {pending ? "Збереження..." : part ? "Зберегти зміни" : "Додати деталь"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create AddPartButton**

Write `src/app/admin/parts/AddPartButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";

export function AddPartButton({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
        <IconPlus /> Деталь
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Нова деталь">
        <PartForm onSuccess={() => setOpen(false)} suppliers={suppliers} />
      </Drawer>
    </>
  );
}
```

- [ ] **Step 3: Create Parts table**

Write `src/app/admin/parts/table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { IconSearch, IconEdit, IconDelete, IconWarning } from "@/components/icons";
import { deletePart } from "@/lib/actions/parts";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";

type PartRow = { id: string; name: string; part_number: string | null; type: string; compatible_with: string | null; cost_price: number; price: number | null; stock: number; min_stock: number; supplier_name: string };

const typeLabels: Record<string, string> = { screen: "Екран", battery: "АКБ", charging_port: "Порт", cable: "Шлейф", button: "Кнопка", camera: "Камера", speaker: "Динамік", other: "Інше" };

export function PartsTable({ parts, suppliers }: { parts: PartRow[]; suppliers: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState("all");

  async function handleDelete(id: string) {
    if (!confirm("Видалити цю деталь?")) return;
    const res = await deletePart(id);
    if (!res.success) alert(res.error);
  }

  const filtered = parts.filter(p => {
    if (filter === "low" && p.stock > p.min_stock) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.part_number ?? "").toLowerCase().includes(q) || (p.compatible_with ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"><IconSearch /></span>
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук деталі..." className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === "all" ? "bg-violet text-white" : "bg-violet/5 text-text-secondary hover:bg-violet/10"}`}>Усі</button>
          <button onClick={() => setFilter("low")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === "low" ? "bg-rose text-white" : "bg-rose/5 text-text-secondary hover:bg-rose/10"}`}>Закінчуються</button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
              <th className="pb-2 pr-4">Назва</th>
              <th className="pb-2 pr-4">Part №</th>
              <th className="pb-2 pr-4">Тип</th>
              <th className="pb-2 pr-4">Сумісність</th>
              <th className="pb-2 pr-4">Постачальник</th>
              <th className="pb-2 pr-4 text-right">Склад</th>
              <th className="pb-2 pr-4 text-right">Собів.</th>
              <th className="pb-2 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-text-secondary">Нічого не знайдено</td></tr>
            ) : (
              filtered.map(p => {
                const isLow = p.stock <= p.min_stock;
                return (
                  <tr key={p.id} className="border-b border-iris/5 text-text-primary transition-colors hover:bg-violet/[0.02]">
                    <td className="py-3 pr-4 font-medium">{p.name}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary font-mono">{p.part_number || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary"><span className="rounded bg-iris/5 px-2 py-0.5">{typeLabels[p.type] || p.type}</span></td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.compatible_with || "—"}</td>
                    <td className="py-3 pr-4 text-xs text-text-secondary">{p.supplier_name}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-medium ${isLow ? "text-rose" : "text-cyan"}`}>
                        {p.stock} {isLow && <IconWarning className="inline h-3 w-3" />}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-text-secondary">{p.cost_price.toLocaleString()} грн</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(p)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet"><IconEdit /></button>
                        <button onClick={() => handleDelete(p.id)} className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"><IconDelete /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Drawer isOpen={!!editing} onClose={() => setEditing(null)} title="Редагувати деталь">
        {editing && <PartForm onSuccess={() => setEditing(null)} part={editing} suppliers={suppliers} />}
      </Drawer>
    </>
  );
}
```

- [ ] **Step 4: Create Parts page**

Write `src/app/admin/parts/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

import { getParts, getPartsAlerts } from "@/lib/data-parts";
import { getSuppliers } from "@/lib/data-suppliers";
import { PartsTable } from "./table";
import { AddPartButton } from "./AddPartButton";
import { pluralUk } from "@/lib/utils/plural";

function GlassCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card p-5 ${className ?? ""}`}>{children}</div>;
}

export default async function PartsPage() {
  const [parts, alerts, suppliers] = await Promise.all([getParts(), getPartsAlerts(), getSuppliers()]);

  const totalParts = parts.length;
  const totalValue = parts.reduce((s, p) => s + p.cost_price * p.stock, 0);
  const lowCount = alerts.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Запчастини</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{totalParts} {pluralUk(totalParts, "деталь", "деталі", "деталей")}</p>
        </div>
        <AddPartButton suppliers={suppliers} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Всього позицій</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalParts}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Сума запасів (собівартість)</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">{totalValue.toLocaleString()} грн</p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Закінчуються</p>
          <p className={`mt-2 text-3xl font-light tracking-tight ${lowCount > 0 ? "text-rose" : "text-cyan"}`}>{lowCount}</p>
        </GlassCard>
      </div>

      <GlassCard>
        <PartsTable parts={parts} suppliers={suppliers} />
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 5: Add sidebar link for parts**

Modify `src/components/AdminSidebar.tsx` — add Parts link.

---

### Task 6: Add Sidebar Links and Loading States

**Files:**
- Modify: `src/components/AdminSidebar.tsx`
- Create: `src/app/admin/suppliers/loading.tsx`
- Create: `src/app/admin/parts/loading.tsx`

- [ ] **Step 1: Verify AdminSidebar.tsx pattern and add links**

Read the sidebar to see how links are structured. Add Suppliers and Parts entries following the same pattern.

- [ ] **Step 2: Create loading states**

```tsx
// src/app/admin/suppliers/loading.tsx
export default function Loading() {
  return <div className="space-y-5"><div className="h-8 w-48 rounded bg-warm-border/30 animate-pulse" /><div className="card p-5"><div className="h-64 rounded bg-warm-border/20 animate-pulse" /></div></div>;
}

// src/app/admin/parts/loading.tsx — same pattern
```

---

### Task 7: Smoke Test

- [ ] **Step 1: Run lint**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: build succeeds, new pages accessible at `/admin/suppliers` and `/admin/parts`.
