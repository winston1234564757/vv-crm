"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { AccessoryForm } from "@/components/forms/AccessoryForm";
import { IconPlus } from "@/components/icons";

import type { Database } from "@/types/database";

export function AddAccessoryButton({ safes = [] }: { safes?: Database["public"]["Tables"]["safes"]["Row"][] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover"
      >
        <IconPlus /> Додати аксесуар
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий аксесуар">
        <AccessoryForm onSuccess={() => setIsOpen(false)} safes={safes} />
      </Drawer>
    </>
  );
}
