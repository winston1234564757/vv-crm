"use client";

import { useState, useTransition } from "react";
import { IconClose, IconPlus, IconSpinner } from "@/components/icons";
import { 
  createStoreLaunchCategory, 
  updateStoreLaunchCategory, 
  deleteStoreLaunchCategory 
} from "@/lib/actions/store-launch";

type Category = {
  id: string;
  name: string;
  budget_limit: number;
  color: string;
};

const COLORS = [
  { id: "slate", label: "Сірий", bg: "bg-slate-500" },
  { id: "violet", label: "Фіолетовий", bg: "bg-violet" },
  { id: "rose", label: "Рожевий", bg: "bg-rose" },
  { id: "amber", label: "Помаранчевий", bg: "bg-amber-500" },
  { id: "emerald", label: "Зелений", bg: "bg-emerald" },
  { id: "sky", label: "Блакитний", bg: "bg-sky-500" },
];

export default function StageManagerModal({ 
  categories, 
  onClose 
}: { 
  categories: Category[], 
  onClose: () => void 
}) {
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createStoreLaunchCategory(null, formData);
      setIsCreating(false);
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateStoreLaunchCategory(id, formData);
      setEditingId(null);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Ви впевнені, що хочете видалити цей етап? Задачі та витрати перейдуть у статус 'Без категорії'.")) return;
    startTransition(async () => {
      await deleteStoreLaunchCategory(id);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center items-center bg-slate-900/40 animate-fade-in p-4">
      <div className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col overflow-hidden max-h-[85vh] animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-warm-border">
          <h2 className="text-lg font-semibold text-text-primary text-balance tracking-tight">Налаштування етапів</h2>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-warm-hover">
            <IconClose size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="border border-warm-border rounded-xl p-3 bg-warm-surface shadow-sm">
              {editingId === cat.id ? (
                <form onSubmit={(e) => handleUpdate(e, cat.id)} className="space-y-3">
                  <div className="flex flex-col md:flex-row gap-2">
                    <input name="name" defaultValue={cat.name} required placeholder="Назва етапу" className="flex-1 rounded-lg border border-warm-border/60 px-3 py-2 text-sm outline-none" />
                    <input name="budget_limit" type="number" defaultValue={cat.budget_limit} required placeholder="Бюджет (₴)" className="w-full md:w-28 rounded-lg border border-warm-border/60 px-3 py-2 text-sm outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Колір:</span>
                    <div className="flex gap-1">
                      {COLORS.map(c => (
                        <label key={c.id} className="cursor-pointer">
                          <input type="radio" name="color" value={c.id} defaultChecked={cat.color === c.id} className="peer sr-only" />
                          <div className={`w-6 h-6 rounded-full ${c.bg} opacity-50 peer-checked:opacity-100 peer-checked:ring-2 ring-offset-1 ring-text-primary transition-all`} title={c.label} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <button type="button" onClick={() => handleDelete(cat.id)} disabled={isPending} className="text-xs text-rose hover:underline font-medium">Видалити</button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm text-text-secondary font-medium">Скасувати</button>
                      <button type="submit" disabled={isPending} className="bg-violet text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center min-w-[80px]">
                        {isPending ? <IconSpinner size={16} className="animate-spin" /> : "Зберегти"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${COLORS.find(c => c.id === cat.color)?.bg || "bg-slate-500"}`} />
                      <span className="font-medium text-text-primary text-sm">{cat.name}</span>
                    </div>
                    <span className="text-xs text-text-secondary font-mono">Бюджет: {cat.budget_limit.toLocaleString()} ₴</span>
                  </div>
                  <button onClick={() => setEditingId(cat.id)} className="text-xs font-medium text-violet px-2 py-1 bg-violet/10 rounded hover:bg-violet/20 transition-colors">
                    Редагувати
                  </button>
                </div>
              )}
            </div>
          ))}

          {isCreating ? (
            <form onSubmit={handleCreate} className="border border-violet/30 rounded-xl p-3 bg-violet/5 space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <input name="name" required placeholder="Назва етапу" className="flex-1 rounded-lg border border-warm-border/60 px-3 py-2 text-sm outline-none bg-white" />
                <input name="budget_limit" type="number" required placeholder="Бюджет (₴)" className="w-full md:w-28 rounded-lg border border-warm-border/60 px-3 py-2 text-sm outline-none bg-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">Колір:</span>
                <div className="flex gap-1">
                  {COLORS.map(c => (
                    <label key={c.id} className="cursor-pointer">
                      <input type="radio" name="color" value={c.id} defaultChecked={c.id === "slate"} className="peer sr-only" />
                      <div className={`w-6 h-6 rounded-full ${c.bg} opacity-50 peer-checked:opacity-100 peer-checked:ring-2 ring-offset-1 ring-text-primary transition-all`} title={c.label} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-sm text-text-secondary font-medium">Скасувати</button>
                <button type="submit" disabled={isPending} className="bg-violet text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center justify-center min-w-[80px]">
                  {isPending ? <IconSpinner size={16} className="animate-spin" /> : "Створити"}
                </button>
              </div>
            </form>
          ) : (
            <button 
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-warm-border hover:border-violet/50 hover:bg-violet/5 text-sm font-medium text-text-secondary hover:text-violet transition-colors"
            >
              <IconPlus size={16} /> Додати етап
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
