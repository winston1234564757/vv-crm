"use client";

import { useState, useTransition } from "react";
import { IconSpinner } from "@/components/icons";
import {
  updateStoreLaunchTask,
  deleteStoreLaunchTask,
  updateStoreLaunchExpense,
  deleteStoreLaunchExpense,
  updateStoreLaunchCategory,
  deleteStoreLaunchCategory,
  updateStoreLaunchMilestone,
  deleteStoreLaunchMilestone,
} from "@/lib/actions/store-launch";

type Category = { id: string; name: string; color: string; };
type Milestone = { id: string; title: string; };

export type EditItemType = "task" | "expense" | "category" | "milestone";

export default function StoreLaunchEditModal({ 
  isOpen, 
  onClose, 
  itemType, 
  itemData, 
  categories 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  itemType: EditItemType; 
  itemData: any; 
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !itemData) return null;

  const handleAction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      if (itemType === "task") {
        await updateStoreLaunchTask(itemData.id, formData);
      } else if (itemType === "expense") {
        await updateStoreLaunchExpense(itemData.id, formData);
      } else if (itemType === "category") {
        await updateStoreLaunchCategory(itemData.id, formData);
      } else if (itemType === "milestone") {
        await updateStoreLaunchMilestone(itemData.id, formData);
      }
      onClose();
    });
  };

  const handleDelete = () => {
    if (!confirm("Ви впевнені, що хочете видалити цей запис? Це дія незворотна.")) return;
    
    startTransition(async () => {
      if (itemType === "task") {
        await deleteStoreLaunchTask(itemData.id);
      } else if (itemType === "expense") {
        await deleteStoreLaunchExpense(itemData.id);
      } else if (itemType === "category") {
        await deleteStoreLaunchCategory(itemData.id);
      } else if (itemType === "milestone") {
        await deleteStoreLaunchMilestone(itemData.id);
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => !isPending && onClose()} />
      
      <div className="relative w-full max-w-lg bg-warm-surface rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up border border-warm-border/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-warm-border/50">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Редагування запису</h2>
          <button type="button" onClick={() => !isPending && onClose()} className="p-2 rounded-full hover:bg-black/5 text-text-secondary transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAction} className="p-6 flex flex-col gap-6">
          
          {itemType === "task" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва завдання</label>
                <input name="title" defaultValue={itemData.title} required autoFocus className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Відповідальний</label>
                  <div className="relative">
                    <select name="assignee" defaultValue={itemData.assignee || ""} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                      <option value="">Не призначено</option>
                      <option value="Власник">Власник</option>
                      <option value="Менеджер">Менеджер</option>
                      <option value="Підрядник">Підрядник</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Дедлайн</label>
                  <input name="due_date" type="date" defaultValue={itemData.due_date || ""} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Напрямок (Категорія)</label>
                <div className="relative">
                  <select name="category_id" defaultValue={itemData.category_id || ""} required className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                    <option value="" disabled>Оберіть напрямок...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>
              <input type="hidden" name="status" value={itemData.status} />
            </div>
          )}

          {itemType === "expense" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва витрати</label>
                <input name="title" defaultValue={itemData.title} required autoFocus className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Сума (₴)</label>
                  <input name="amount" type="number" defaultValue={itemData.amount} required className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-mono text-text-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Статус</label>
                  <div className="relative">
                    <select name="status" defaultValue={itemData.status} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                      <option value="planned">План (Заплановано)</option>
                      <option value="paid">Оплачено</option>
                      <option value="received">Отримано (Доставлено)</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Напрямок (Бюджет)</label>
                  <div className="relative">
                    <select name="category_id" defaultValue={itemData.category_id || ""} required className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                      <option value="" disabled>Оберіть напрямок...</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Тип витрати</label>
                  <div className="relative">
                    <select name="type" defaultValue={itemData.type} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                      <option value="fee">Послуга</option>
                      <option value="purchase">Товар / Матеріали</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Посилання</label>
                  <input name="url" type="url" defaultValue={itemData.url || ""} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Дата оплати</label>
                  <input name="paid_at" type="date" defaultValue={itemData.paid_at || ""} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
                </div>
              </div>
            </div>
          )}

          {itemType === "category" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва напрямку</label>
                <input name="name" defaultValue={itemData.name} required autoFocus className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Плановий Бюджет (₴)</label>
                  <input name="budget_limit" type="number" defaultValue={itemData.budget_limit} required className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-mono text-text-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Колір маркеру</label>
                  <div className="relative">
                    <select name="color" defaultValue={itemData.color} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                      <option value="violet">Фіолетовий</option>
                      <option value="blue">Синій</option>
                      <option value="emerald">Смарагдовий</option>
                      <option value="amber">Бурштиновий</option>
                      <option value="rose">Рожевий</option>
                      <option value="slate">Сірий</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {itemType === "milestone" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва етапу</label>
                <input name="title" defaultValue={itemData.title} required autoFocus className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Дедлайн</label>
                <input name="target_date" type="date" defaultValue={itemData.target_date || ""} className="w-full px-4 py-3 rounded-xl bg-white border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
              </div>
            </div>
          )}

          <div className="mt-2 flex gap-3 pt-4 border-t border-warm-border/50">
            <button type="button" onClick={handleDelete} disabled={isPending} className="px-4 py-3 rounded-xl border border-rose/30 text-rose text-sm font-bold hover:bg-rose/10 transition-colors">
              Видалити
            </button>
            <button type="button" onClick={() => !isPending && onClose()} disabled={isPending} className="flex-1 px-4 py-3 rounded-xl border border-warm-border/60 text-text-secondary text-sm font-bold hover:bg-black/5 transition-colors">
              Скасувати
            </button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-3 rounded-xl bg-violet text-white text-sm font-bold flex justify-center items-center gap-2 hover:bg-violet/90 transition-colors shadow-[0_4px_14px_rgba(109,40,217,0.3)] hover:shadow-[0_6px_20px_rgba(109,40,217,0.4)] disabled:opacity-70">
              {isPending ? <IconSpinner className="animate-spin" size={18} /> : "Зберегти"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
