import { IconCheck, IconSpinner } from "@/components/icons";
import { format, parseISO, isPast, isToday } from "date-fns";
import { uk } from "date-fns/locale";

type Category = { id: string; name: string; budget_limit: number; color: string; };
type Task = { id: string; title: string; status: string; category_id: string | null; assignee?: string | null; due_date?: string | null; };
type Expense = { id: string; title: string; amount: number; category_id: string | null; type: string; url: string | null; status: string; paid_at?: string | null; };

type AnalyticsProps = {
  categories: Category[];
  tasks: Task[];
  expenses: Expense[];
  totalBudget: number;
  totalSpent: number;
};

const colorBgMap: Record<string, string> = {
  violet: 'bg-violet',
  blue: 'bg-info',
  emerald: 'bg-emerald',
  amber: 'bg-warning',
  rose: 'bg-rose',
  slate: 'bg-muted',
};

const colorTextMap: Record<string, string> = {
  violet: 'text-violet',
  blue: 'text-info',
  emerald: 'text-emerald',
  amber: 'text-warning',
  rose: 'text-rose',
  slate: 'text-muted',
};

export default function StoreLaunchAnalytics({ categories, tasks, expenses, totalBudget, totalSpent }: AnalyticsProps) {
  // --- 1. Focus Engine (Smart Insights) ---
  const insights: { type: 'danger' | 'warning' | 'success' | 'info', message: string }[] = [];

  // Insight A: Overbudget categories
  const overbudgetCategories = categories.filter(c => {
    const spent = expenses.filter(e => e.category_id === c.id && e.status !== "planned").reduce((sum, e) => sum + e.amount, 0);
    return spent > c.budget_limit && c.budget_limit > 0;
  });
  if (overbudgetCategories.length > 0) {
    insights.push({
      type: 'danger',
      message: `Перевитрата бюджету в напрямках: ${overbudgetCategories.map(c => c.name).join(', ')}.`
    });
  }

  // Insight B: Overdue tasks
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  if (overdueTasks.length > 0) {
    insights.push({
      type: 'warning',
      message: `${overdueTasks.length} завдань протерміновано. Зверніть увагу на "${overdueTasks[0].title}".`
    });
  }

  // Insight C: Pending large expenses (planned)
  const pendingExpenses = expenses.filter(e => e.status === 'planned').sort((a,b) => b.amount - a.amount);
  if (pendingExpenses.length > 0) {
    insights.push({
      type: 'info',
      message: `Очікується оплата: ${pendingExpenses[0].title} (${pendingExpenses[0].amount.toLocaleString('uk-UA')} ₴).`
    });
  }

  // Insight D: General health if no danger/warning
  if (insights.filter(i => i.type === 'danger' || i.type === 'warning').length === 0) {
    insights.unshift({
      type: 'success',
      message: "Все під контролем. Бюджети в межах лімітів, критичних затримок немає."
    });
  }

  // --- 2. Capital Allocation ---
  const validCategories = categories.filter(c => c.budget_limit > 0);
  const totalAllocated = validCategories.reduce((s, c) => s + c.budget_limit, 0);

  // --- 3. Task Velocity ---
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const taskVelocity = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary text-balance tracking-tight">Executive Cockpit</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Focus Engine */}
        <div className="col-span-1 lg:col-span-1 rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 relative">
          <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface/90 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          
          <div className="relative z-10 flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Smart Insights</h3>
            <p className="text-2xl font-bold text-text-primary tracking-tight leading-tight">Ваш фокус на сьогодні</p>
          </div>

          <div className="relative z-10 flex flex-col gap-3">
            {insights.slice(0, 3).map((insight, idx) => (
              <div key={idx} className={`flex gap-3 p-4 rounded-2xl border ${
                insight.type === 'danger' ? 'bg-rose/5 border-rose/20 text-rose' :
                insight.type === 'warning' ? 'bg-warning/5 border-warning/20 text-warning' :
                insight.type === 'success' ? 'bg-emerald/5 border-emerald/20 text-emerald' :
                'bg-info/5 border-info/20 text-info'
              }`}>
                <div className="shrink-0 mt-0.5">
                  {insight.type === 'danger' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>}
                  {insight.type === 'warning' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>}
                  {insight.type === 'success' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>}
                  {insight.type === 'info' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>}
                </div>
                <span className="text-sm font-medium leading-snug">{insight.message}</span>
              </div>
            ))}
          </div>
        </div>
        </div>

        <div className="col-span-1 lg:col-span-2 flex flex-col gap-6">
          {/* Capital Allocation */}
          <div className="flex-1 rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 relative">
            <div className="h-full bg-warm-surface/90 rounded-[calc(2rem-0.375rem)] p-6 md:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-col justify-center">
            <div className="flex justify-between items-end mb-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Capital Allocation</h3>
                <span className="text-xl font-bold text-text-primary">Розподіл Бюджету</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-text-primary">{totalAllocated.toLocaleString("uk-UA")} ₴</span>
                <p className="text-[10px] text-text-secondary uppercase tracking-wider mt-1">Загальний Ліміт</p>
              </div>
            </div>

            {totalAllocated === 0 ? (
              <div className="h-6 w-full bg-black/5 dark:bg-surface/5 rounded-full" />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Stacked Bar */}
                <div className="flex h-6 w-full bg-black/5 dark:bg-surface/5 rounded-full overflow-hidden shadow-inner">
                  {validCategories.map(c => {
                    const pct = (c.budget_limit / totalAllocated) * 100;
                    if (pct === 0) return null;
                    return (
                      <div 
                        key={c.id} 
                        className={`h-full ${colorBgMap[c.color] || colorBgMap['slate']} transition-all hover:brightness-110 border-r border-warm-surface/20 last:border-0`} 
                        style={{ width: `${pct}%` }}
                        title={`${c.name}: ${c.budget_limit.toLocaleString('uk-UA')} ₴ (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {validCategories.map(c => {
                    const pct = (c.budget_limit / totalAllocated) * 100;
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colorBgMap[c.color] || colorBgMap['slate']}`} />
                        <span className="text-xs font-medium text-text-secondary">{c.name} <span className="font-mono ml-1 opacity-70">{Math.round(pct)}%</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </div>

          <div className="flex-1 rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 relative">
            <div className="h-full bg-warm-surface/90 rounded-[calc(2rem-0.375rem)] p-6 md:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-8 justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Task Velocity</h3>
              <span className="text-xl font-bold text-text-primary">Прогрес Виконання</span>
              <p className="text-sm text-text-secondary mt-1">
                Виконано {doneTasks} з {totalTasks} завдань.
              </p>
            </div>

            {/* Circular Progress Indicator */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle 
                  cx="50" cy="50" r="40" 
                  fill="none" 
                  className="stroke-black/5 dark:stroke-white/10" 
                  strokeWidth="8" 
                />
                <circle 
                  cx="50" cy="50" r="40" 
                  fill="none" 
                  className="stroke-violet transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]" 
                  strokeWidth="8" 
                  strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * taskVelocity) / 100}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-xl font-bold font-mono tracking-tighter text-text-primary">{taskVelocity}%</span>
              </div>
            </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
