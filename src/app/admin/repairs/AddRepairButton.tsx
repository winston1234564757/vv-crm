"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { RepairForm } from "@/components/forms/RepairForm";
import { IconPlus } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

export function AddRepairButton({
  customers,
  className = "flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover",
  children = <><IconPlus /> Новий ремонт</>,
  size = "default"
}: {
  customers: Customer[];
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "full";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`btn-press ${className}`}
      >
        {children}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий ремонт" size={size}>
        <RepairForm customers={customers} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
