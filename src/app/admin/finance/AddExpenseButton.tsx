"use client";

import { useState } from "react";
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
      <button
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl bg-rose px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-hover cursor-pointer"
      >
        📉 Додати витрату
      </button>

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
