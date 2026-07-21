"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { TopUpForm } from "@/components/forms/TopUpForm";

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export function AddTopUpButton({
  safes,
}: {
  safes: Safe[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        👛 Поповнити з гаманця
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Поповнення сейфу з гаманця" size="default">
        <TopUpForm
          safes={safes}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
