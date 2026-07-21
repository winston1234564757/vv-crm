"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconSpinner } from "@/components/icons";
import {
  createStoreLaunchTask,
  createStoreLaunchExpense,
  createStoreLaunchCategory,
  createStoreLaunchMilestone,
} from "@/lib/actions/store-launch";

type Category = { id: string; name: string; color: string; };
type Milestone = { id: string; title: string; };

export default function StoreLaunchCreateModal({ categories, milestones }: { categories: Category[], milestones: Milestone[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"task" | "expense" | "category" | "milestone">("task");
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    if (!isPending) setIsOpen(false);
  };

  const handleAction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      if (activeTab === "task") {
        await createStoreLaunchTask(null, formData);
      } else if (activeTab === "expense") {
        await createStoreLaunchExpense(null, formData);
      } else if (activeTab === "category") {
        await createStoreLaunchCategory(null, formData);
      } else if (activeTab === "milestone") {
        await createStoreLaunchMilestone(null, formData);
      }
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="group relative flex h-12 items-center justify-center gap-2 rounded-full bg-violet text-white px-6 py-2 font-medium transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-violet/90 hover:shadow-[0_4px_20px_rgba(109,40,217,0.3)] active:scale-[0.98]"
      >
        <IconPlus size={16} /> 
        <span className="text-sm font-semibold tracking-wide">Додати</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={handleClose} />
          
          <div className="relative w-full max-w-lg bg-warm-surface rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up border border-warm-border/50">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-warm-border/50">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Новий запис</h2>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-black/5 text-text-secondary transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-2 gap-1 bg-black/5 mx-6 mt-4 rounded-xl">
              {[
                { id: "task", label: "Завдання" },
                { id: "expense", label: "Витрата" },
                { id: "category", label: "Категорія" },
                { id: "milestone", label: "Етап" },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300 ${activeTab === tab.id ? 'bg-surface shadow-sm text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleAction} className="p-6 flex flex-col gap-6">
              
              {activeTab === "task" && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва завдання</label>
                    <input name="title" required autoFocus placeholder="Що потрібно зробити?" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary placeholder:text-text-muted" />
                    <p className="text-[11px] text-text-muted pl-1">Наприклад: Орендувати приміщення, Замовити вивіску</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Відповідальний</label>
                      <div className="relative">
                        <select name="assignee" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                          <option value="">Не призначено</option>
                          <option value="Власник">Власник</option>
                          <option value="Менеджер">Менеджер</option>
                          <option value="Підрядник">Підрядник</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                      <p className="text-[11px] text-text-muted pl-1">Хто буде виконувати?</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Дедлайн</label>
                      <input name="due_date" type="date" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
                      <p className="text-[11px] text-text-muted pl-1">Крайня дата виконання</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Напрямок (Категорія)</label>
                    <div className="relative">
                      <select name="category_id" required className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                        <option value="" disabled selected>Оберіть напрямок...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                    <p className="text-[11px] text-text-muted pl-1">До якої категорії належить?</p>
                  </div>
                </div>
              )}

              {activeTab === "expense" && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва витрати</label>
                    <input name="title" required autoFocus placeholder="За що платимо?" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary placeholder:text-text-muted" />
                    <p className="text-[11px] text-text-muted pl-1">Наприклад: Оренда за перший місяць, Ноутбук</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Сума (₴)</label>
                      <input name="amount" type="number" required placeholder="0" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-mono text-text-primary placeholder:text-text-muted" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Статус</label>
                      <div className="relative">
                        <select name="status" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
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
                        <select name="category_id" required className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
                          <option value="" disabled selected>Оберіть напрямок...</option>
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
                        <select name="type" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
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
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Посилання (Опційно)</label>
                      <input name="url" type="url" placeholder="https://..." className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary placeholder:text-text-muted" />
                      <p className="text-[11px] text-text-muted pl-1">Лінк на товар чи договір</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Дата оплати (Опційно)</label>
                      <input name="paid_at" type="date" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
                      <p className="text-[11px] text-text-muted pl-1">Фактична дата платежу</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "category" && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва напрямку</label>
                    <input name="name" required autoFocus placeholder="Напр. Ремонт, Маркетинг, Меблі" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary placeholder:text-text-muted" />
                    <p className="text-[11px] text-text-muted pl-1">Глобальний напрямок робіт</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Плановий Бюджет (₴)</label>
                      <input name="budget_limit" type="number" required placeholder="0" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-mono text-text-primary placeholder:text-text-muted" />
                      <p className="text-[11px] text-text-muted pl-1">Ліміт на цей напрямок</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Колір маркеру</label>
                      <div className="relative">
                        <select name="color" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary appearance-none cursor-pointer">
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
                      <p className="text-[11px] text-text-muted pl-1">Для діаграм</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "milestone" && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Назва етапу</label>
                    <input name="title" required autoFocus placeholder="Напр. Підписання договору" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary placeholder:text-text-muted" />
                    <p className="text-[11px] text-text-muted pl-1">Глобальний етап запуску (відобразиться на Радарі)</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Дедлайн (Опціонально)</label>
                    <input name="target_date" type="date" className="w-full px-4 py-3 rounded-xl bg-surface border border-warm-border/60 outline-none focus:border-violet focus:ring-1 focus:ring-violet transition-all text-sm font-medium text-text-primary" />
                    <p className="text-[11px] text-text-muted pl-1">Цільова дата досягнення етапу</p>
                  </div>
                </div>
              )}

              <div className="mt-2 flex gap-3 pt-4 border-t border-warm-border/50">
                <button type="button" onClick={handleClose} disabled={isPending} className="flex-1 px-4 py-3 rounded-xl border border-warm-border/60 text-text-secondary text-sm font-bold hover:bg-black/5 transition-colors">
                  Скасувати
                </button>
                <button type="submit" disabled={isPending} className="flex-1 px-4 py-3 rounded-xl bg-violet text-white text-sm font-bold flex justify-center items-center gap-2 hover:bg-violet/90 transition-colors shadow-[0_4px_14px_rgba(109,40,217,0.3)] hover:shadow-[0_6px_20px_rgba(109,40,217,0.4)] disabled:opacity-70">
                  {isPending ? <IconSpinner className="animate-spin" size={18} /> : "Зберегти"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
