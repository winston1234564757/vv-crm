import { requireRole } from "@/lib/utils/rbac";
import {
  getStoreLaunchCategories,
  getStoreLaunchTasks,
  getStoreLaunchExpenses,
  getStoreLaunchMilestones,
} from "@/lib/data-store-launch";
import StoreLaunchKanban from "@/app/admin/store-launch/components/StoreLaunchKanban";
import StoreLaunchBudgets from "@/app/admin/store-launch/components/StoreLaunchBudgets";
import StoreLaunchMilestones from "@/app/admin/store-launch/components/StoreLaunchMilestones";
import SeedDataButton from "@/app/admin/store-launch/components/SeedDataButton";

export const metadata = {
  title: "Запуск Магазину | VV CRM",
};

export default async function StoreLaunchPage() {
  await requireRole(["owner"]);

  const [categories, tasks, expenses, milestones] = await Promise.all([
    getStoreLaunchCategories(),
    getStoreLaunchTasks(),
    getStoreLaunchExpenses(),
    getStoreLaunchMilestones(),
  ]);

  // Calculate Metrics
  const totalBudget = categories.reduce((sum, c) => sum + c.budget_limit, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidExpenses = expenses.filter(e => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);
  const burnRatePercent = totalBudget > 0 ? Math.min(Math.round((paidExpenses / totalBudget) * 100), 100) : 0;
  
  const tasksCompleted = tasks.filter(t => t.status === "done").length;
  const tasksTotal = tasks.length;
  const taskProgress = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  const finalMilestone = milestones.length > 0 ? [...milestones].sort((a,b) => {
    const timeA = a.target_date ? new Date(a.target_date).getTime() : 0;
    const timeB = b.target_date ? new Date(b.target_date).getTime() : 0;
    return timeB - timeA;
  })[0] : null;
  const daysLeft = (finalMilestone && finalMilestone.target_date) ? Math.max(0, Math.ceil((new Date(finalMilestone.target_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) : 0;

  return (
    <div className="flex flex-col gap-12 p-4 md:p-8 pb-32 md:pb-12 w-full max-w-[1600px] mx-auto animate-fade-in-up">
      
      {/* Header & Seeder */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-warm-border/50">
        <div className="flex flex-col gap-3">
          <span className="rounded-full bg-violet/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-violet w-max">
            Workspace
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary text-balance">
            Store Launch
          </h1>
          <p className="text-base text-text-secondary max-w-xl">
            Комплексний дашборд для контролю бюджету, задач та етапів відкриття нового магазину.
          </p>
        </div>
        <div className="w-full md:w-auto flex justify-start md:justify-end">
          <SeedDataButton />
        </div>
      </div>

      {/* Metrics Bento (The Asymmetrical Bento) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1: Budget */}
        <div className="group rounded-[2rem] p-1.5 bg-black/5 dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black/10">
          <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-6 md:p-8 flex flex-col justify-between gap-8">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-widest tracking-tight">Використання бюджету</h3>
            <div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold text-text-primary">{paidExpenses.toLocaleString("uk-UA")}</span>
                <span className="text-lg text-text-secondary mb-1">/ {totalBudget.toLocaleString("uk-UA")} ₴</span>
              </div>
              <div className="w-full h-2 rounded-full bg-warm-border/50 overflow-hidden">
                <div className="h-full bg-violet rounded-full transition-all duration-1000 ease-out" style={{ width: `${burnRatePercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Operational Velocity */}
        <div className="group rounded-[2rem] p-1.5 bg-black/5 dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black/10">
          <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-6 md:p-8 flex flex-col justify-between gap-8">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-widest tracking-tight">Операційна швидкість</h3>
            <div>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold text-text-primary">{tasksCompleted}</span>
                <span className="text-lg text-text-secondary mb-1">/ {tasksTotal} задач</span>
              </div>
              <div className="w-full h-2 rounded-full bg-warm-border/50 overflow-hidden">
                <div className="h-full bg-emerald rounded-full transition-all duration-1000 ease-out" style={{ width: `${taskProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Time to Launch */}
        <div className="group rounded-[2rem] p-1.5 bg-black/5 dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black/10">
          <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-6 md:p-8 flex flex-col justify-between gap-8">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-widest tracking-tight">Днів до відкриття</h3>
            <div>
              <div className="flex items-end gap-3 mb-2">
                <span className="text-5xl font-bold text-text-primary leading-none">{daysLeft}</span>
                <span className="text-lg text-text-secondary mb-1">днів</span>
              </div>
              <p className="text-sm text-text-secondary mt-3">
                Дедлайн: <strong className="text-text-primary">{(finalMilestone && finalMilestone.target_date) ? new Date(finalMilestone.target_date).toLocaleDateString('uk-UA') : 'Не встановлено'}</strong>
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Main Grid: Kanban and Sidebars */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
        {/* Main Column (Tasks & Kanban) */}
        <div className="xl:col-span-2 flex flex-col gap-6 w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-between mb-2">
             <h2 className="text-2xl font-bold text-text-primary text-balance tracking-tight">Дошка Задач</h2>
          </div>
          <StoreLaunchKanban tasks={tasks} categories={categories} />
        </div>

        {/* Sidebar Column (Milestones & Budgets) */}
        <div className="flex flex-col gap-12 w-full max-w-full overflow-hidden">
          <StoreLaunchMilestones milestones={milestones} />
          <StoreLaunchBudgets categories={categories} expenses={expenses} />
        </div>
      </div>
    </div>
  );
}
