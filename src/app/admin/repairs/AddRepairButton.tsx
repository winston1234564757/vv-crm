"use client";

import { useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { RepairForm } from "@/components/forms/RepairForm";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

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
 *
 * `customers` is now optional. Pages that already have the list (Ремонти)
 * keep passing it. The dashboard no longer loads it on the server — that
 * lookup is dead weight until someone actually opens this drawer — so when
 * the prop is omitted the button fetches it itself, once, on open.
 */
export function AddRepairButton({
  customers,
  className,
  children,
  variant = "primary",
}: {
  customers?: Customer[];
  className?: string;
  children?: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [lazyCustomers, setLazyCustomers] = useState<Customer[]>([]);
  const needsFetch = customers === undefined;

  useEffect(() => {
    if (!isOpen || !needsFetch) return;
    let cancelled = false;
    createClient()
      .from("customers")
      .select("id, name, phone")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) setLazyCustomers(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, needsFetch]);

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
        <RepairForm customers={customers ?? lazyCustomers} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
