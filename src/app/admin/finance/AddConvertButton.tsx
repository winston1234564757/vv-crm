"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { ConvertSafeForm } from "@/components/forms/ConvertSafeForm";

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
  cashBalance: number;
  cardBalance: number;
}

interface CashRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AddConvertButton({
  safes,
  cashRegisters,
}: {
  safes: Safe[];
  cashRegisters: CashRegister[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        💱 Конвертація
      </Button>

      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Конвертація готівка ↔ безготівка"
        size="default"
      >
        <ConvertSafeForm
          safes={safes}
          cashRegisters={cashRegisters}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
