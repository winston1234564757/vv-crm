import { requireRole } from "@/lib/utils/rbac";
import {
  getStoreLaunchCategories,
  getStoreLaunchTasks,
  getStoreLaunchExpenses,
  getStoreLaunchMilestones,
} from "@/lib/data-store-launch";
import SeedDataButton from "@/app/admin/store-launch/components/SeedDataButton";
import GlobalLaunchRadar from "@/app/admin/store-launch/components/GlobalLaunchRadar";
import DomainCard from "@/app/admin/store-launch/components/DomainCard";
import StoreLaunchCreateModal from "@/app/admin/store-launch/components/StoreLaunchCreateModal";

export const metadata = {
  title: "Запуск Магазину (Mission Control) | VV CRM",
};

export default async function StoreLaunchPage() {
  await requireRole(["owner"]);

  const [categories, tasks, expenses, milestones] = await Promise.all([
    getStoreLaunchCategories(),
    getStoreLaunchTasks(),
    getStoreLaunchExpenses(),
    getStoreLaunchMilestones(),
  ]);

  // Global Metrics
  const totalBudget = categories.reduce((sum, c) => sum + c.budget_limit, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-12 p-4 md:p-8 pb-32 md:pb-12 w-full max-w-[1600px] mx-auto animate-fade-in-up">
      
      {/* Header & Seeder */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 pb-6 border-b border-warm-border/50">
        <div className="flex flex-col gap-3">
          <span className="rounded-full bg-violet/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium text-violet w-max">
            Mission Control
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary text-balance">
            Store Launch
          </h1>
          <p className="text-base text-text-secondary max-w-xl">
            Комплексний дашборд для контролю бюджету, задач та етапів відкриття нового магазину з висоти пташиного польоту.
          </p>
        </div>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 justify-start md:justify-end">
          <StoreLaunchCreateModal categories={categories} milestones={milestones} />
          <SeedDataButton />
        </div>
      </div>

      {/* Global Launch Radar */}
      <GlobalLaunchRadar 
        milestones={milestones}
        totalBudget={totalBudget}
        totalSpent={totalSpent}
      />

      {/* Matrix of Operations (Bento Grid) */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-primary text-balance tracking-tight">Матриця Операцій</h2>
          <span className="text-sm text-text-secondary font-medium px-3 py-1 bg-warm-surface rounded-full border border-warm-border/50">
            {categories.length} Напрямків
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 items-start">
          {categories.length === 0 ? (
            <div className="col-span-full py-20 text-center text-text-secondary bg-warm-surface dark:bg-black/20 rounded-[2rem] border border-dashed border-warm-border">
              Категорії не знайдено. Використайте кнопку Seed Data для наповнення.
            </div>
          ) : (
            categories.map(cat => {
              const catTasks = tasks.filter(t => t.category_id === cat.id);
              const catExpenses = expenses.filter(e => e.category_id === cat.id);
              return (
                <DomainCard 
                  key={cat.id} 
                  category={cat} 
                  tasks={catTasks} 
                  expenses={catExpenses} 
                />
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
