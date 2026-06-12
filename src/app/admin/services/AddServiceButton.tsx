"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { ServiceForm } from "@/components/forms/ServiceForm";
import { IconPlus } from "@/components/icons";

export function AddServiceButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
      >
        <IconPlus /> Додати послугу
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Нова послуга">
        <ServiceForm onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
