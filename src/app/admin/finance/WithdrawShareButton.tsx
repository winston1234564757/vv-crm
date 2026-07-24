"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { WithdrawShareForm } from "@/components/forms/WithdrawShareForm";

interface SourceItem {
  id: string;
  name: string;
  type: "safe" | "cash_register";
  balance: number;
}

export function WithdrawShareButton({
  safes = [],
  cashRegisters = [],
  label = "💵 Зняти частку",
  className,
}: {
  safes?: { id: string; name: string; type: string; balance: number }[];
  cashRegisters?: { id: string; name: string; balance: number }[];
  label?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const sources: SourceItem[] = [
    ...safes.map((s) => ({
      id: s.id,
      name: s.name,
      type: "safe" as const,
      balance: s.balance,
    })),
    ...cashRegisters.map((c) => ({
      id: c.id,
      name: c.name,
      type: "cash_register" as const,
      balance: c.balance,
    })),
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          className ||
          "btn-press flex items-center gap-1.5 rounded-xl bg-emerald/10 hover:bg-emerald/20 border border-emerald/30 text-emerald px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer"
        }
      >
        {label}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="💵 Вилучення частки прибутку" size="default">
        <WithdrawShareForm sources={sources} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
