"use client";

import { useState, useTransition } from "react";
import { IconCheck, IconPlus, IconSpinner } from "@/components/icons";
import { 
  updateStoreLaunchTaskStatus, 
  createStoreLaunchTask,
  updateStoreLaunchExpenseStatus,
  createStoreLaunchExpense
} from "@/lib/actions/store-launch";

type Category = { id: string; name: string; budget_limit: number; color: string; };
type Task = { id: string; title: string; status: string; category_id: string | null; };
type Expense = { id: string; title: string; amount: number; category_id: string | null; type: string; url: string | null; status: string; };

type DomainCardProps = {
  category: Category;
  tasks: Task[];
  expenses: Expense[];
};

export default function DomainCard({ category, tasks, expenses }: DomainCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [addingTask, setAddingTask] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);

  // Metrics
  const tasksCompleted = tasks.filter(t => t.status === "done").length;
  const tasksTotal = tasks.length;
  const tasksProgress = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  const totalSpent = expenses.filter(e => e.status !== "planned").reduce((sum, e) => sum + e.amount, 0);
  const budgetLimit = category.budget_limit;
  const burnRatePercent = budgetLimit > 0 ? Math.min((totalSpent / budgetLimit) * 100, 100) : 0;

  // Health
  const isOverBudget = totalSpent > budgetLimit && budgetLimit > 0;
  const healthColor = isOverBudget ? 'bg-rose text-rose' : (burnRatePercent > 80 ? 'bg-amber-500 text-amber-500' : 'bg-emerald text-emerald');

  const handleTaskStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "done" ? "todo" : "done";
    startTransition(async () => {
      await updateStoreLaunchTaskStatus(id, nextStatus);
    });
  };

  const handleExpenseStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "planned" ? "paid" : currentStatus === "paid" ? "received" : "planned";
    startTransition(async () => {
      await updateStoreLaunchExpenseStatus(id, nextStatus);
    });
  };

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("category_id", category.id);
    formData.append("status", "todo");
    startTransition(async () => {
      await createStoreLaunchTask(null, formData);
      setAddingTask(false);
    });
  };

  const handleCreateExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("category_id", category.id);
    startTransition(async () => {
      await createStoreLaunchExpense(null, formData);
      setAddingExpense(false);
    });
  };

  return (
    <div className={`group rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col ${isOpen ? 'col-span-1 md:col-span-2 xl:col-span-3' : ''}`}>
      <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface/80 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
        
        {/* Header / Summary View */}
        <div 
          className="flex flex-col gap-5 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          {/* Title Row */}
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${healthColor.split(' ')[0]} shadow-sm`} />
            <h3 className="text-xl font-bold text-text-primary tracking-tight">{category.name}</h3>
          </div>

          {/* Metrics & Chevron Row */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-6 xl:gap-10 flex-1 pr-4">
              {/* Task Metric */}
              <div className="flex flex-col gap-1.5 w-full max-w-[140px]">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Завдання</span>
                  <span className="text-sm font-bold text-text-primary">{tasksCompleted}/{tasksTotal}</span>
                </div>
                <div className="h-1.5 w-full bg-warm-border/50 rounded-full overflow-hidden">
                  <div className="h-full bg-text-primary transition-all duration-1000" style={{ width: `${tasksProgress}%` }} />
                </div>
              </div>

              {/* Budget Metric */}
              <div className="flex flex-col gap-1.5 w-full max-w-[160px]">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Бюджет</span>
                  <span className="text-sm font-bold font-mono text-text-primary">{Math.round(burnRatePercent)}%</span>
                </div>
                <div className="h-1.5 w-full bg-warm-border/50 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${healthColor.split(' ')[0]}`} style={{ width: `${burnRatePercent}%` }} />
                </div>
              </div>
            </div>

            <button className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-warm-surface text-text-secondary transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          </div>
        </div>

        {/* Expanded Details View */}
        {isOpen && (
          <div className="pt-6 border-t border-warm-border/50 grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in-up">
            
            {/* Tasks Column */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-primary">Список Завдань</h4>
                <button onClick={(e) => { e.stopPropagation(); setAddingTask(!addingTask); }} className="text-xs font-semibold text-violet hover:text-violet/80 transition-colors uppercase tracking-wider flex items-center gap-1">
                  <IconPlus size={14} /> Додати
                </button>
              </div>

              {addingTask && (
                <form onSubmit={handleCreateTask} className="flex gap-2 p-3 rounded-xl border border-warm-border/60 bg-white dark:bg-black/20">
                  <input name="title" required autoFocus placeholder="Назва завдання..." className="flex-1 bg-transparent text-sm font-medium outline-none text-text-primary" />
                  <button type="submit" disabled={isPending} className="px-3 rounded-lg bg-violet text-white text-xs font-semibold">Зберегти</button>
                </form>
              )}

              <div className="flex flex-col gap-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-black/20 border border-warm-border/40 hover:border-violet/30 transition-colors group/task">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleTaskStatus(task.id, task.status); }}
                      className={`flex w-6 h-6 items-center justify-center rounded-full border-2 transition-all ${task.status === 'done' ? 'border-emerald bg-emerald text-white' : 'border-warm-border hover:border-violet text-transparent'}`}
                    >
                      <IconCheck size={12} />
                    </button>
                    <span className={`text-sm font-medium flex-1 ${task.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'}`}>{task.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses Column */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-primary">Витрати (Burn Rate: {totalSpent.toLocaleString("uk-UA")} ₴)</h4>
                <button onClick={(e) => { e.stopPropagation(); setAddingExpense(!addingExpense); }} className="text-xs font-semibold text-violet hover:text-violet/80 transition-colors uppercase tracking-wider flex items-center gap-1">
                  <IconPlus size={14} /> Додати
                </button>
              </div>

              {addingExpense && (
                <form onSubmit={handleCreateExpense} className="flex flex-col gap-2 p-3 rounded-xl border border-warm-border/60 bg-white dark:bg-black/20">
                  <div className="flex gap-2">
                    <input name="title" required autoFocus placeholder="Назва витрати..." className="flex-1 bg-transparent text-sm font-medium outline-none text-text-primary" />
                    <input name="amount" type="number" required placeholder="Сума" className="w-24 bg-transparent text-sm font-mono outline-none text-text-primary" />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <select name="type" className="text-xs font-medium bg-transparent text-text-secondary outline-none appearance-none">
                      <option value="fee">Послуга</option>
                      <option value="purchase">Товар</option>
                    </select>
                    <button type="submit" disabled={isPending} className="px-3 py-1.5 rounded-lg bg-violet text-white text-xs font-semibold">Зберегти</button>
                  </div>
                </form>
              )}

              <div className="flex flex-col gap-2">
                {expenses.map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black/20 border border-warm-border/40 hover:border-violet/30 transition-colors">
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-sm font-medium text-text-primary truncate">{exp.title}</span>
                      <span className="text-[10px] font-mono text-text-secondary">{exp.amount.toLocaleString("uk-UA")} ₴</span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleExpenseStatus(exp.id, exp.status); }}
                      className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider ${exp.status === 'received' ? 'bg-emerald/10 text-emerald' : exp.status === 'paid' ? 'bg-amber-500/10 text-amber-500' : 'bg-black/5 text-text-secondary'}`}
                    >
                      {exp.status === 'planned' ? 'План' : exp.status === 'paid' ? 'Оплачено' : 'Отримано'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
