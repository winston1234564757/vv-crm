"use client";

import { useState } from "react";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";

import type { Database } from "@/types/database";

export function AddPartButton({ 
  suppliers,
  safes = []
}: { 
  suppliers: { id: string; name: string }[];
  safes?: Database["public"]["Tables"]["safes"]["Row"][];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover cursor-pointer">
        <IconPlus /> Деталь
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Нова деталь">
        <PartForm onSuccess={() => setOpen(false)} suppliers={suppliers} safes={safes} />
      </Drawer>
    </>
  );
}
