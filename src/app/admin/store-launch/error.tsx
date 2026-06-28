"use client";

import { useEffect } from "react";
import { IconGrid } from "@/components/icons";

export default function StoreLaunchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isRelationError = error?.message?.includes("relation") && error?.message?.includes("does not exist");

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose/10 text-rose mb-4">
        <IconGrid size={32} />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-text-primary mb-2 text-balance">
        Помилка завантаження дашборду
      </h2>
      <p className="text-sm text-text-secondary max-w-md mb-6">
        {isRelationError 
          ? "Схоже, таблиці для цього розділу відсутні в базі даних. Будь ласка, виконайте міграцію (npx supabase db push) на вашому сервері."
          : (error?.message || "Сталася невідома помилка при отриманні даних.")}
      </p>
      <button
        onClick={reset}
        className="btn-press rounded-xl bg-violet px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-60"
      >
        Спробувати знову
      </button>
    </div>
  );
}
