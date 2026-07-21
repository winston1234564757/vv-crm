"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { SupplierForm } from "@/components/forms/SupplierForm";

export function AddSupplierButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <IconPlus /> Постачальник
      </Button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Новий постачальник">
        <SupplierForm onSuccess={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
