"use client";

import { useState } from "react";
import AICopilotDrawer from "@/components/ai/AICopilotDrawer";

export function AIFinanceButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full sm:w-auto justify-center cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-hover whitespace-nowrap"
      >
        <span className="sm:hidden">✨ AI Аналітик</span>
        <span className="hidden sm:inline">✨ AI Фінансовий Аналітик</span>
      </button>

      <AICopilotDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        entityType="finance"
        entityId="finance"
        entityName="Фінансовий Контроль"
      />
    </>
  );
}
