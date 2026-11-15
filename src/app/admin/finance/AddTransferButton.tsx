"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
  balance_cash?: number | null;
  balance_cashless?: number | null;
  cashBalance?: number;
  cardBalance?: number;
}

export function AddTransferButton({
  cashRegisters,
}: {
  cashRegisters: CashRegister[];
  safes?: unknown[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto justify-center whitespace-nowrap px-3 sm:px-4 text-xs"
      >
        💸 Здійснити переказ
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Переказ між рахунками" size="default">
        <TransferForm
          cashRegisters={cashRegisters}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
