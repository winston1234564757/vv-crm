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

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AddExpenseButton({
  expenseCategories,
  safes,
}: {
  expenseCategories: ExpenseCategory[];
  safes: Safe[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        📉 Додати витрату
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Створення нової витрати" size="default">
        <ExpenseForm
          expenseCategories={expenseCategories}
          safes={safes}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
