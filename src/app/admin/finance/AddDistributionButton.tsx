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
        className="btn-press flex items-center gap-1.5 rounded-xl bg-violet/10 hover:bg-violet/20 border border-violet/30 text-violet px-5 py-3 text-sm font-medium transition-colors cursor-pointer"
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
