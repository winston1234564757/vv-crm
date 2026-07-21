"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { ServiceForm } from "@/components/forms/ServiceForm";
import { IconPlus } from "@/components/icons";

export function AddServiceButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        <IconPlus /> Додати послугу
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Нова послуга">
        <ServiceForm onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
