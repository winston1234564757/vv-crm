"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { AccessoryForm } from "@/components/forms/AccessoryForm";
import { IconPlus } from "@/components/icons";

import type { Database } from "@/types/database";

export function AddAccessoryButton({ safes = [] }: { safes?: Database["public"]["Tables"]["safes"]["Row"][] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        <IconPlus /> Додати аксесуар
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий аксесуар">
        <AccessoryForm onSuccess={() => setIsOpen(false)} safes={safes} />
      </Drawer>
    </>
  );
}
