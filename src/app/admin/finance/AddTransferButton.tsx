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
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        💸 Здійснити переказ
      </Button>

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
