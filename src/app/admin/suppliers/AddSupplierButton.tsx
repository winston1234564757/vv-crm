"use client";

import { useState } from "react";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { SupplierForm } from "@/components/forms/SupplierForm";

export function AddSupplierButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
        <IconPlus /> Постачальник
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Новий постачальник">
        <SupplierForm onSuccess={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
