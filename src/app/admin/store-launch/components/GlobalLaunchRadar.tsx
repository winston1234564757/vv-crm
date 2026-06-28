"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { uk } from "date-fns/locale";

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
    <div className="group rounded-[2.5rem] p-1.5 bg-black/[0.03] dark:bg-warm-surface ring-1 ring-black/5 dark:ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] w-full relative">
      
      {/* Decorative Glow */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet/20 rounded-full blur-[120px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 mix-blend-screen pointer-events-none" />

      <div className="relative h-full rounded-[calc(2.5rem-0.375rem)] bg-warm-surface/90 shadow-[inset_0_1px_1px_rgba(255,255,255,1)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-8 md:p-10 flex flex-col md:flex-row gap-12 justify-between items-center z-10 backdrop-blur-xl">
        
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
                  <div className="absolute -bottom-10 opacity-0 group-hover/node:opacity-100 transition-all duration-300 translate-y-2 group-hover/node:translate-y-0 whitespace-nowrap bg-black dark:bg-white text-white dark:text-black text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl z-20">
                    <div className="font-bold">{m.title}</div>
                    {m.target_date && <div className="text-[10px] opacity-80">{format(parseISO(m.target_date), "d MMM", { locale: uk })}</div>}
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
    </div>
  );
}
