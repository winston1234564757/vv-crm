"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { uk } from "date-fns/locale";
import StoreLaunchEditModal, { EditItemType } from "./StoreLaunchEditModal";

type Milestone = {
  id: string;
  title: string;
  target_date: string | null;
  is_completed: boolean;
};

type GlobalRadarProps = {
  milestones: Milestone[];
  totalBudget: number;
  totalSpent: number;
};

export default function GlobalLaunchRadar({ milestones, totalBudget, totalSpent }: GlobalRadarProps) {
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Calculations
  const burnRatePercent = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;
  
  const sortedMilestones = useMemo(() => {
    return [...milestones].sort((a,b) => {
      const timeA = a.target_date ? new Date(a.target_date).getTime() : 0;
      const timeB = b.target_date ? new Date(b.target_date).getTime() : 0;
      return timeA - timeB;
    });
  }, [milestones]);

  const finalMilestone = sortedMilestones[sortedMilestones.length - 1];
  const daysLeft = (finalMilestone && finalMilestone.target_date) 
    ? Math.max(0, Math.ceil((new Date(finalMilestone.target_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))) 
    : 0;

  return (
    <>
      <div className="w-full rounded-xl bg-warm-surface border border-warm-border shadow-[0_1px_3px_oklch(0%_0_0_/_0.06)] hover:shadow-[0_4px_12px_oklch(0%_0_0_/_0.1)] transition-shadow duration-300 relative p-6 md:p-8 flex flex-col md:flex-row gap-10 justify-between items-center">
          
          {/* Left Side: Launch Trajectory (Milestones Timeline) */}
          <div className="flex-1 w-full">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-[0.2em] mb-8">Траєкторія Відкриття</h3>
            
            {sortedMilestones.length === 0 ? (
              <div className="text-sm text-text-muted italic">Етапи не визначено</div>
            ) : (
              <div className="relative flex items-center justify-between w-full mt-4">
                {/* Connecting Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-warm-border/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-violet transition-all duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)]" 
                    style={{ width: `${Math.max(5, (sortedMilestones.filter(m => m.is_completed).length / Math.max(1, sortedMilestones.length)) * 100)}%` }} 
                  />
                </div>

                {/* Milestone Nodes */}
                {sortedMilestones.map((m, i) => (
                  <div key={m.id} className="relative z-10 flex flex-col items-center group/node cursor-default">
                    <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 transition-all duration-500 shadow-sm ${m.is_completed ? 'bg-violet border-violet scale-110 shadow-violet/30' : 'bg-white dark:bg-slate-900 border-warm-border/80'}`} />
                    
                    {/* Tooltip */}
                    <div className="absolute -bottom-12 opacity-0 group-hover/node:opacity-100 pointer-events-none group-hover/node:pointer-events-auto transition-all duration-300 translate-y-2 group-hover/node:translate-y-0 whitespace-nowrap bg-black dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl z-20 flex items-center gap-3">
                      <div className="flex flex-col">
                        <div className="font-bold">{m.title}</div>
                        {m.target_date && <div className="text-[10px] opacity-80">{format(parseISO(m.target_date), "d MMM", { locale: uk })}</div>}
                      </div>
                      <button 
                        onClick={() => setEditingMilestone(m)}
                        className="ml-2 p-1.5 bg-white/20 dark:bg-black/10 rounded hover:bg-white/30 dark:hover:bg-black/20 transition-colors"
                        title="Редагувати"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Key Health Metrics */}
          <div className="flex gap-12 shrink-0 border-t md:border-t-0 md:border-l border-warm-border/50 pt-8 md:pt-0 md:pl-12 w-full md:w-auto">
            
            {/* Burn Rate */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Бюджет</h4>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold font-mono text-text-primary tracking-tighter">
                  {burnRatePercent}%
                </span>
              </div>
              <div className="text-xs text-text-secondary font-mono tracking-tight">
                {totalSpent.toLocaleString("uk-UA")} / {totalBudget.toLocaleString("uk-UA")} ₴
              </div>
            </div>

            {/* Time to Zero */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">T-Zero</h4>
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold font-mono tracking-tighter ${daysLeft < 7 ? 'text-rose' : 'text-text-primary'}`}>
                  {daysLeft}
                </span>
                <span className="text-base text-text-secondary mb-1">днів</span>
              </div>
              <div className="text-xs text-text-secondary tracking-tight">
                {finalMilestone?.target_date ? format(parseISO(finalMilestone.target_date), "d MMMM", { locale: uk }) : "Не визначено"}
              </div>
            </div>

          </div>

        </div>

      <StoreLaunchEditModal 
        isOpen={editingMilestone !== null} 
        onClose={() => setEditingMilestone(null)} 
        itemType="milestone" 
        itemData={editingMilestone} 
        categories={[]} 
      />
    </>
  );
}
