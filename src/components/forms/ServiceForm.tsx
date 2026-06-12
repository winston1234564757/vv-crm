"use client";

import { useActionState, useEffect } from "react";
import { createService, updateService } from "@/lib/actions/inventory";
import { Input } from "@/components/ui/Input";

const initialState = { success: false, error: "" };

export function ServiceForm({ onSuccess, service }: { onSuccess: () => void; service?: { id: string; name: string; description: string | null; price: number; category: string; is_visible: boolean; duration_minutes?: number | null; warranty_days?: number | null } }) {
  const action = service ? updateService.bind(null, service.id) : createService;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-5 p-2">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>
      )}

      <Input label="Назва послуги" name="name" required placeholder="Прошивка, Чистка, Діагностика..." defaultValue={service?.name} />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Опис</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={service?.description ?? ""}
          placeholder="Опис послуги..."
          className="w-full resize-none rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Ціна (грн)" name="price" type="number" required placeholder="500" defaultValue={service?.price.toString()} />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Категорія</label>
          <select
            name="category"
            required
            defaultValue={service?.category ?? "other"}
            className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
          >
            <option value="diagnostics">Діагностика</option>
            <option value="software">ПЗ / Прошивка</option>
            <option value="cleaning">Чистка</option>
            <option value="setup">Налаштування</option>
            <option value="other">Інше</option>
          </select>
        </div>
      </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="duration_minutes" className="mb-1.5 block text-xs font-medium text-text-secondary">Тривалість (хв)</label>
            <input id="duration_minutes" name="duration_minutes" type="number" placeholder="30" defaultValue={service?.duration_minutes?.toString() ?? ""} className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
          </div>
          <div>
            <label htmlFor="warranty_days" className="mb-1.5 block text-xs font-medium text-text-secondary">Гарантія (днів)</label>
            <input id="warranty_days" name="warranty_days" type="number" placeholder="0" defaultValue={service?.warranty_days?.toString() ?? "0"} className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
          </div>
        </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" name="is_visible" defaultChecked={service?.is_visible ?? true} className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" />
        <span className="text-sm font-medium text-text-primary">Показувати на вітрині</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? "Збереження..." : service ? "Зберегти зміни" : "Створити послугу"}
      </button>
    </form>
  );
}
