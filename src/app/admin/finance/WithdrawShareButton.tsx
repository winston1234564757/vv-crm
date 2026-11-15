"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { WithdrawShareForm } from "@/components/forms/WithdrawShareForm";

export interface CashRegisterSummary {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function WithdrawShareButton({
  profitFund = 0,
  cashRegisters = [],
  label = "💵 Зняти прибуток",
  className,
}: {
  profitFund?: number;
  cashRegisters?: CashRegisterSummary[];
  safes?: unknown[];
  label?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          className ||
          "btn-press flex w-full sm:w-auto justify-center cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] border border-success/30 bg-success-subtle px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-success transition-colors hover:bg-success/20 whitespace-nowrap"
        }
      >
        {label}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="💵 Зняття чистого прибутку" size="default">
        <WithdrawShareForm
          profitFund={profitFund}
          cashRegisters={cashRegisters}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
