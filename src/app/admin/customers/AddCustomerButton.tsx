"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { CustomerForm } from "@/components/forms/CustomerForm";
import { IconPlus } from "@/components/icons";

export function AddCustomerButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        <IconPlus /> Додати клієнта
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий клієнт">
        <CustomerForm onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
