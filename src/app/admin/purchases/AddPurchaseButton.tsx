"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";
import Drawer from "@/components/ui/Drawer";
import { PurchaseForm } from "@/components/forms/PurchaseForm";

interface Safe {
  id: string;
  name: string;
  balance: number;
}

export function AddPurchaseButton({ safes = [] }: { safes?: Safe[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <IconPlus /> Закупівля
      </Button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Нова закупівля">
        <PurchaseForm onSuccess={() => setOpen(false)} safes={safes} />
      </Drawer>
    </>
  );
}
