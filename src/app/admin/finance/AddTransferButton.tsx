"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { TransferForm } from "@/components/forms/TransferForm";

interface CashRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
}

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AddTransferButton({
  cashRegisters,
  safes,
}: {
  cashRegisters: CashRegister[];
  safes: Safe[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
      >
        💸 Здійснити переказ
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Переказ між касами та сейфами" size="default">
        <TransferForm
          cashRegisters={cashRegisters}
          safes={safes}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
