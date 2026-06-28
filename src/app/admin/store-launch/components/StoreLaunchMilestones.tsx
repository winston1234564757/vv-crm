"use client";

import { useState, useTransition } from "react";
import { IconCheck, IconPlus, IconSpinner } from "@/components/icons";
import { toggleStoreLaunchMilestone, createStoreLaunchMilestone } from "@/lib/actions/store-launch";
import { format, parseISO } from "date-fns";
import { uk } from "date-fns/locale";

type Milestone = {
  id: string;
  title: string;
  target_date: string | null;
  is_completed: boolean;
};

export default function StoreLaunchMilestones({ milestones }: { milestones: Milestone[] }) {
  const [isPending, startTransition] = useTransition();
  const [isAdding, setIsAdding] = useState(false);

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      await toggleStoreLaunchMilestone(id, !currentStatus);
    });
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createStoreLaunchMilestone(null, formData);
      setIsAdding(false);
    });
  };

  return (
    <div className="group/mile rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col flex-1 w-full max-w-full overflow-hidden">
      <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface/80 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-4 md:p-6 flex flex-col">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-bold text-text-primary tracking-wide text-balance tracking-tight">Ключові Етапи</h2>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="group relative flex h-10 items-center justify-center gap-2 rounded-full bg-violet/10 px-4 font-medium text-violet transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-violet/20 active:scale-95"
            aria-label="Додати етап"
          >
            <IconPlus size={16} className={`transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isAdding ? 'rotate-45' : ''}`} />
            <span className="hidden sm:inline text-sm">Додати етап</span>
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleCreate} className="mb-6 rounded-[1.25rem] border border-warm-border/60 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up">
            <input
              name="title"
              required
              list="milestone-suggestions"
              placeholder="Назва етапу"
              className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-3 text-sm md:text-base font-medium outline-none focus:border-violet/40 text-text-primary placeholder:text-text-muted"
            />
            <datalist id="milestone-suggestions">
              <option value="Підписання договору оренди" />
              <option value="Завершення ремонту" />
              <option value="Завезення товару та вітрин" />
              <option value="Налаштування обладнання" />
              <option value="Навчання персоналу" />
              <option value="Тестове відкриття (Soft Launch)" />
              <option value="Офіційне відкриття" />
            </datalist>
            <input
              name="target_date"
              type="date"
              className="w-full rounded-xl border border-warm-border/60 bg-transparent px-4 py-3 text-sm md:text-base outline-none focus:border-violet/40 text-text-primary placeholder:text-text-muted"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="flex-1 sm:flex-none h-12 sm:h-10 px-6 rounded-full text-sm font-medium text-text-secondary hover:text-text-primary bg-black/5 hover:bg-black/10 dark:bg-warm-surface dark:hover:bg-warm-surface transition-colors"
              >
                Скасувати
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 sm:flex-none h-12 sm:h-10 px-8 rounded-full bg-violet text-white text-sm font-medium shadow-sm transition-transform active:scale-95 flex items-center justify-center min-w-[120px]"
              >
                {isPending ? <IconSpinner size={16} className="animate-spin" /> : "Зберегти"}
              </button>
            </div>
          </form>
        )}

        {milestones.length === 0 && !isAdding ? (
          <div className="py-12 text-center text-sm text-text-secondary bg-warm-surface dark:bg-black/20 rounded-[1.25rem] border border-dashed border-warm-border">
            Ще немає ключових етапів.
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`group/mile-item flex items-center gap-4 rounded-[1.25rem] border p-4 transition-all duration-500 hover:shadow-md ${
                  m.is_completed
                    ? "border-emerald/20 bg-emerald/5 dark:bg-emerald/10 hover:border-emerald/40"
                    : "border-warm-border/50 bg-white dark:bg-black/20 hover:border-violet/30"
                }`}
              >
                <button
                  onClick={() => handleToggle(m.id, m.is_completed)}
                  disabled={isPending}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 active:scale-90 ${
                    m.is_completed
                      ? "border-emerald bg-emerald text-white"
                      : "border-warm-border/80 text-transparent hover:border-violet hover:text-violet/30"
                  }`}
                >
                  <IconCheck size={14} />
                </button>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={`text-sm md:text-base font-semibold truncate transition-all duration-300 ${m.is_completed ? "text-text-muted line-through" : "text-text-primary"}`}>
                    {m.title}
                  </span>
                  {m.target_date && (
                    <span className="text-xs md:text-sm text-text-secondary font-medium tracking-tight mt-0.5">
                      Дедлайн: {format(parseISO(m.target_date), "d MMM yyyy", { locale: uk })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
