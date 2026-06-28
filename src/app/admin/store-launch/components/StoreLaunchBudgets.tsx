"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconSpinner } from "@/components/icons";
import { createStoreLaunchExpense, updateStoreLaunchExpenseStatus } from "@/lib/actions/store-launch";
import TagSelect from "@/components/ui/TagSelect";

type Category = {
  id: string;
  name: string;
  budget_limit: number;
  color: string;
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  category_id: string | null;
  type: string; // 'purchase' | 'fee'
  url: string | null;
  status: string; // 'planned' | 'paid' | 'received'
};

export default function StoreLaunchBudgets({ categories, expenses }: { categories: Category[], expenses: Expense[] }) {
  const [isPending, startTransition] = useTransition();
  const [addingExpense, setAddingExpense] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const handleCreateExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createStoreLaunchExpense(null, formData);
      setAddingExpense(false);
      setSelectedCategoryId("");
    });
  };

  const toggleExpenseStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "planned" ? "paid" : currentStatus === "paid" ? "received" : "planned";
    startTransition(async () => {
      await updateStoreLaunchExpenseStatus(id, nextStatus);
    });
  };

  const getTotalSpent = (categoryId: string) => {
    return expenses
      .filter(e => e.category_id === categoryId && e.status !== "planned")
      .reduce((sum, e) => sum + e.amount, 0);
  };

  return (
    <div className="group/budget rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col flex-1 w-full max-w-full overflow-hidden">
      <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface/80 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-4 md:p-6 flex flex-col">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-bold text-text-primary tracking-wide text-balance tracking-tight">Бюджети & Витрати</h2>
          <button
            onClick={() => setAddingExpense(!addingExpense)}
            className="group relative flex h-10 items-center justify-center gap-2 rounded-full bg-violet px-4 font-medium text-white shadow-sm transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-violet/90 active:scale-95"
            aria-label="Додати витрату"
          >
            <IconPlus size={16} className={`transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${addingExpense ? 'rotate-45' : ''}`} />
            <span className="hidden sm:inline text-sm">Додати витрату</span>
          </button>
        </div>

        {addingExpense && (
          <form onSubmit={handleCreateExpense} className="mb-6 rounded-[1.25rem] border border-warm-border/60 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up">
            <div className="flex flex-col sm:flex-row gap-3">
              <input name="title" required autoFocus list="expense-suggestions" placeholder="Назва покупки/витрати" className="flex-1 rounded-xl border border-warm-border/60 px-4 py-3 text-sm md:text-base font-medium outline-none text-text-primary placeholder:text-text-muted" />
              <datalist id="expense-suggestions">
                <option value="Оренда приміщення" />
                <option value="Ремонт та матеріали" />
                <option value="Закупівля товару" />
                <option value="Рекламна вивіска" />
                <option value="Оплата праці підрядників" />
                <option value="Касовий апарат ПРРО" />
                <option value="Меблі та вітрини" />
                <option value="Маркетинг та реклама" />
              </datalist>
              <input name="amount" type="number" required placeholder="Сума (₴)" className="w-full sm:w-32 rounded-xl border border-warm-border/60 px-4 py-3 text-sm md:text-base outline-none text-text-primary placeholder:text-text-muted" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <TagSelect
                  name="category_id"
                  options={categories.map(c => ({ id: c.id, label: c.name, color: c.color }))}
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                  placeholder="Оберіть категорію..."
                />
              </div>
              <select name="type" className="w-full sm:w-32 rounded-xl border border-warm-border/60 px-4 py-3 text-sm font-medium outline-none text-text-primary bg-transparent appearance-none">
                <option value="fee">Послуга</option>
                <option value="purchase">Товар</option>
              </select>
            </div>
            <input name="url" placeholder="Посилання (опціонально)" className="w-full rounded-xl border border-warm-border/60 px-4 py-3 text-sm outline-none text-text-primary placeholder:text-text-muted" />
            <div className="flex justify-end gap-3 pt-2 w-full">
              <button type="button" onClick={() => setAddingExpense(false)} className="flex-1 sm:flex-none h-12 sm:h-10 px-6 rounded-full text-sm font-medium text-text-secondary hover:text-text-primary bg-black/5 hover:bg-black/10 dark:bg-warm-surface dark:hover:bg-warm-surface transition-colors">Скасувати</button>
              <button type="submit" disabled={isPending} className="flex-1 sm:flex-none h-12 sm:h-10 px-8 rounded-full bg-violet text-white text-sm font-medium shadow-sm transition-transform active:scale-95 flex items-center justify-center min-w-[120px]">
                {isPending ? <IconSpinner className="animate-spin w-5 h-5" /> : "Зберегти"}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-8 w-full max-w-full">
          {categories.length === 0 ? (
            <div className="text-center text-sm text-text-secondary py-12 bg-warm-surface dark:bg-black/20 rounded-[1.25rem] border border-dashed border-warm-border">Створіть категорію для відстеження бюджету.</div>
          ) : (
            categories.map(cat => {
              const spent = getTotalSpent(cat.id);
              const percent = cat.budget_limit > 0 ? Math.min(100, Math.round((spent / cat.budget_limit) * 100)) : 0;
              const catExpenses = expenses.filter(e => e.category_id === cat.id);

              return (
                <div key={cat.id} className="flex flex-col gap-3 w-full">
                  <div className="flex justify-between items-end px-1">
                    <span className="text-base font-semibold text-text-primary tracking-wide">{cat.name}</span>
                    <span className="text-xs md:text-sm text-text-secondary font-mono tracking-tight">
                      <strong className="text-text-primary">{spent.toLocaleString("uk-UA")}</strong> / {cat.budget_limit.toLocaleString("uk-UA")} ₴
                    </span>
                  </div>
                  <div className="h-2 md:h-2.5 w-full bg-warm-border/40 dark:bg-warm-surface rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)] ${percent > 95 ? 'bg-rose' : percent > 75 ? 'bg-amber-500' : 'bg-emerald'}`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  
                  {/* Expense List for Category */}
                  {catExpenses.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 w-full">
                      {catExpenses.map(exp => (
                        <div key={exp.id} className="group/exp flex flex-col sm:flex-row justify-between sm:items-center p-3 md:p-4 rounded-[1rem] bg-white dark:bg-black/20 border border-warm-border/50 shadow-sm transition-all duration-500 hover:border-violet/30 hover:shadow-md gap-3 sm:gap-0 w-full">
                          <div className="flex flex-col gap-1 w-full sm:w-auto overflow-hidden">
                            <span className="text-sm font-medium text-text-primary truncate">{exp.title}</span>
                            {exp.url && <a href={exp.url} target="_blank" rel="noreferrer" className="text-[10px] text-violet hover:underline truncate inline-block w-max max-w-full">{exp.url}</a>}
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                            <span className="text-sm font-mono font-medium text-text-primary whitespace-nowrap">{exp.amount.toLocaleString("uk-UA")} ₴</span>
                            <button 
                              onClick={() => toggleExpenseStatus(exp.id, exp.status)}
                              className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-semibold uppercase tracking-wider transition-all duration-300 active:scale-95 whitespace-nowrap ${
                                exp.status === 'received' ? 'bg-emerald/10 text-emerald hover:bg-emerald/20' :
                                exp.status === 'paid' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' :
                                'bg-black/5 dark:bg-warm-surface text-text-secondary hover:bg-black/10 dark:hover:bg-warm-surface'
                              }`}
                            >
                              {exp.status === 'planned' ? 'План' : exp.status === 'paid' ? 'Оплачено' : 'Отримано'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
