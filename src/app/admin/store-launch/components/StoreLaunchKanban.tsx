"use client";

import { useState, useTransition } from "react";
import { IconPlus, IconSpinner, IconSettings } from "@/components/icons";
import { createStoreLaunchTask, updateStoreLaunchTaskStatus } from "@/lib/actions/store-launch";
import TagSelect from "@/components/ui/TagSelect";
import StageManagerModal from "./StageManagerModal";

type Task = {
  id: string;
  title: string;
  status: string;
  category_id: string | null;
  assignee: string | null;
};

type Category = {
  id: string;
  name: string;
  budget_limit: number;
  color: string;
};

const COLUMNS = [
  { id: "todo", label: "До виконання" },
  { id: "in_progress", label: "В процесі" },
  { id: "done", label: "Готово" },
];

export default function StoreLaunchKanban({ tasks, categories }: { tasks: Task[], categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [isManagingStages, setIsManagingStages] = useState(false);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const colorMap: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>, status: string) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("status", status);
    
    startTransition(async () => {
      await createStoreLaunchTask(null, formData);
      setAddingInColumn(null);
      setSelectedCategoryId("");
    });
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    startTransition(async () => {
      await updateStoreLaunchTaskStatus(id, newStatus);
    });
  };

  return (
    <div className="flex flex-col flex-1 w-full relative">
      <div className="absolute -top-12 right-0">
        <button 
          onClick={() => setIsManagingStages(true)}
          className="group relative flex h-10 items-center gap-2 rounded-full bg-warm-surface dark:bg-warm-surface px-4 font-medium text-text-secondary transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white active:scale-[0.98] border border-warm-border/50 shadow-sm"
        >
          <IconSettings size={16} className="transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-90" />
          <span className="text-sm">Налаштувати етапи</span>
        </button>
      </div>

      {/* Grid: 3 columns on Desktop, Stacked on Mobile (No Horizontal Scroll) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-h-[500px]">
        {COLUMNS.map((col, index) => {
          const colTasks = tasks.filter(t => t.status === col.id);
          
          return (
            // The Double-Bezel Column Wrapper
            <div key={col.id} className="group/col rounded-[2rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" style={{ animationDelay: `${index * 150}ms` }}>
              <div className="h-full rounded-[calc(2rem-0.375rem)] bg-warm-surface/80 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-4 md:p-6 flex flex-col">
                
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-text-primary tracking-wide tracking-tight">{col.label}</h3>
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-black/5 dark:bg-warm-surface text-xs font-medium text-text-secondary">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setAddingInColumn(col.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-warm-surface dark:hover:bg-warm-surface text-text-secondary transition-transform duration-300 hover:rotate-90 active:scale-90"
                    aria-label="Add task"
                  >
                    <IconPlus size={16} />
                  </button>
                </div>

                <div className="flex flex-col gap-4 flex-1">
                  {addingInColumn === col.id && (
                    <form onSubmit={(e) => handleCreate(e, col.id)} className="flex flex-col gap-3 p-4 rounded-[1.25rem] bg-white dark:bg-slate-900/60 border border-warm-border/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up">
                      <input
                        name="title"
                        required
                        autoFocus
                        list="task-suggestions"
                        placeholder="Назва задачі"
                        className="w-full bg-transparent text-sm md:text-base font-medium outline-none placeholder:text-text-muted text-text-primary"
                      />
                      <datalist id="task-suggestions">
                        <option value="Укласти договір оренди" />
                        <option value="Оплатити перший місяць оренди" />
                        <option value="Замовити проект електрики" />
                        <option value="Замовити вітрини для телефонів" />
                        <option value="Завезти першу партію товару" />
                        <option value="Розробка вивіски" />
                        <option value="Монтаж освітлення" />
                        <option value="Налаштувати CRM" />
                      </datalist>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-2 w-full">
                        <div className="w-full sm:w-[160px]">
                          <TagSelect 
                            name="category_id" 
                            options={categories.map(c => ({ id: c.id, label: c.name, color: c.color }))}
                            value={selectedCategoryId}
                            onChange={setSelectedCategoryId}
                            placeholder="Без категорії"
                          />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button type="button" onClick={() => setAddingInColumn(null)} className="flex-1 sm:flex-none h-10 px-4 text-sm font-medium text-text-secondary hover:text-text-primary rounded-full transition-colors">Скасувати</button>
                          <button type="submit" disabled={isPending} className="flex-1 sm:flex-none h-10 px-6 rounded-full bg-violet text-white text-sm font-medium shadow-sm transition-transform active:scale-95 flex items-center justify-center min-w-[100px]">
                            {isPending ? <IconSpinner className="animate-spin w-4 h-4" /> : "Зберегти"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {colTasks.map(task => {
                    const cat = categories.find(c => c.id === task.category_id);
                    return (
                      <div key={task.id} className="group/card flex flex-col gap-3 p-4 rounded-[1.25rem] bg-white dark:bg-black/20 border border-warm-border/50 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-violet/30 hover:shadow-md active:scale-[0.98] cursor-grab active:cursor-grabbing">
                        <p className="text-sm md:text-base font-medium text-text-primary leading-snug">{task.title}</p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${cat ? colorMap[cat.color] || colorMap.slate : "bg-warm-border/40 text-text-secondary"}`}>
                            {cat ? cat.name : "Без категорії"}
                          </span>
                          
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity duration-300">
                            {col.id !== "todo" && (
                              <button onClick={() => handleStatusChange(task.id, "todo")} className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 dark:bg-warm-surface transition-colors text-text-secondary" aria-label="Move left">←</button>
                            )}
                            {col.id !== "in_progress" && (
                              <button onClick={() => handleStatusChange(task.id, "in_progress")} className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 dark:bg-warm-surface transition-colors text-text-secondary" aria-label="Move center">{(col.id === "done" ? "←" : "→")}</button>
                            )}
                            {col.id !== "done" && (
                              <button onClick={() => handleStatusChange(task.id, "done")} className="flex items-center justify-center w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 dark:bg-warm-surface transition-colors text-text-secondary" aria-label="Move right">→</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isManagingStages && (
        <StageManagerModal 
          categories={categories} 
          onClose={() => setIsManagingStages(false)} 
        />
      )}
    </div>
  );
}
