"use client";

import { useState } from "react";
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
      <button
        onClick={() => setIsOpen(true)}
        className="btn-press flex items-center gap-1.5 rounded-xl border border-iris/20 bg-warm-surface px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-warm-surface-hover shadow-sm cursor-pointer"
      >
        👛 Поповнити з гаманця
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Поповнення сейфу з гаманця" size="default">
        <TopUpForm
          safes={safes}
          onSuccess={() => setIsOpen(false)}
        />
      </Drawer>
    </>
  );
}
