"use client";

import { useTransition } from "react";
import { IconSpinner, IconDelete } from "@/components/icons";
import { seedStoreLaunchData, clearStoreLaunchData } from "@/lib/actions/seed-store-launch";

export default function SeedDataButton() {
  const [isPending, startTransition] = useTransition();

  const handleSeed = () => {
    if (confirm("УВАГА! Всі поточні дані запуску (задачі, витрати, етапи) будуть ВИДАЛЕНІ і замінені базовими. Продовжити?")) {
      startTransition(async () => {
        await seedStoreLaunchData();
      });
    }
  };

  const handleClear = () => {
    if (confirm("ВИДАЛЕННЯ! Ви впевнені, що хочете очистити всі дані запуску? Цю дію неможливо скасувати.")) {
      startTransition(async () => {
        await clearStoreLaunchData();
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClear}
        disabled={isPending}
        className="group relative flex h-12 items-center justify-center gap-2 rounded-full bg-rose/10 px-6 py-2 font-medium text-rose transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-rose/20 active:scale-[0.98]"
      >
        {isPending ? (
          <IconSpinner className="h-5 w-5 animate-spin" />
        ) : (
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wide">
            <IconDelete size={16} /> Очистити
          </span>
        )}
      </button>

      <button
        onClick={handleSeed}
        disabled={isPending}
        className="group relative flex h-12 items-center justify-center gap-2 rounded-full bg-black/5 dark:bg-warm-surface pl-6 pr-2 py-2 font-medium text-text-primary transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black/10 active:scale-[0.98] dark:hover:bg-warm-surface"
      >
        {isPending ? (
          <IconSpinner className="h-5 w-5 animate-spin mx-4" />
        ) : (
          <span className="flex items-center gap-4">
            <span className="text-sm font-semibold tracking-wide">Демо-дані</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-black shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-[1px] group-hover:translate-x-1 group-hover:scale-[1.01] duration-300 ease-out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-black dark:text-white"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </div>
          </span>
        )}
      </button>
    </div>
  );
}
