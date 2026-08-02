"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { DistributionForm } from "@/components/forms/DistributionForm";
import type { SafeDistribution } from "@/lib/data-settings";

interface CashRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AddDistributionButton({
  cashRegisters,
  settings,
}: {
  cashRegisters: CashRegister[];
  settings: {
    distribution_tech: SafeDistribution;
    distribution_accessories: SafeDistribution;
    distribution_repairs: SafeDistribution;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-press flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-hover"
      >
        📊 Розподілити касу
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Розподіл коштів з каси" size="default">
        <DistributionForm
          cashRegisters={cashRegisters}
          settings={settings}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
