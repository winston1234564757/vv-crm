"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { PartForm } from "@/components/forms/PartForm";

import type { Database } from "@/types/database";

export function AddPartButton({
  suppliers,
  safes = [],
  registers = []
}: {
  suppliers: { id: string; name: string }[];
  safes?: Database["public"]["Tables"]["safes"]["Row"][];
  registers?: Database["public"]["Tables"]["cash_registers"]["Row"][];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <IconPlus /> Деталь
      </Button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Нова деталь">
        <PartForm onSuccess={() => setOpen(false)} suppliers={suppliers} safes={safes} registers={registers} />
      </Drawer>
    </>
  );
}
