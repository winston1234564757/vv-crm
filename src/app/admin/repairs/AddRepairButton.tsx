"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { RepairForm } from "@/components/forms/RepairForm";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

/**
 * `devices`, `initialDeviceId` and `initialIsInternal` are gone.
 *
 * They existed for the form's "Внутрішній (Склад)" toggle, which wrote
 * `inventory_device_id` — and `getAllRepairs` filters exactly those rows out,
 * so a warehouse repair created here vanished from the page it was created on.
 * That is where all 13 orphaned repair rows came from. Warehouse repairs are
 * now started from the device itself, on Техніка, where the result is visible.
 *
 * Nothing passed the two initial props anyway: all three call sites used the
 * defaults.
 */
export function AddRepairButton({
  customers,
  className,
  children,
  variant = "primary",
}: {
  customers: Customer[];
  className?: string;
  children?: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        className={className}
        leadingIcon={<IconPlus />}
        onClick={() => setIsOpen(true)}
      >
        {children ?? "Новий ремонт"}
      </Button>

      {/* Full width: fourteen fields do not fit comfortably in half a screen. */}
      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Прийом у ремонт" size="full">
        <RepairForm customers={customers} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
