"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { ExpenseForm } from "@/components/forms/ExpenseForm";

interface ExpenseCategory {
  id: string;
  name: string;
  safe_type: string;
  description: string | null;
}

interface CashRegisterItem {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AddExpenseButton({
  expenseCategories,
  registers = [],
}: {
  expenseCategories: ExpenseCategory[];
  safes?: unknown[];
  registers?: CashRegisterItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="danger"
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto justify-center whitespace-nowrap px-3 sm:px-4 text-xs"
      >
        📉 Додати витрату
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Створення нової витрати" size="default">
        <ExpenseForm
          expenseCategories={expenseCategories}
          registers={registers}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
