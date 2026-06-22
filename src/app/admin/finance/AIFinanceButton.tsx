"use client";

import { useState } from "react";
import AICopilotDrawer from "@/components/ai/AICopilotDrawer";

export function AIFinanceButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-xl border border-violet/25 bg-violet/[0.02] hover:bg-violet/5 hover:border-violet/40 px-4 py-2.5 text-xs text-violet font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
      >
        <span>✨ AI Фінансовий Аналітик</span>
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
