"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { CustomerForm } from "@/components/forms/CustomerForm";
import { IconPlus } from "@/components/icons";

export function AddCustomerButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
      >
        <IconPlus /> Додати клієнта
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий клієнт">
        <CustomerForm onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
