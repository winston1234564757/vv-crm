"use client";

import { useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { OrderForm } from "@/components/forms/order/OrderForm";
import { Button } from "@/components/ui/Button";
import { IconPlus } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  phone: string;
  discount_percent: number;
  notes?: string | null;
}

/**
 * Третя дія дашборда — оформлення клієнтського замовлення "під клієнта".
 * Дзеркалить AddRepairButton: клієнтів довантажує сам при відкритті, щоб
 * не тягнути список на сервері, поки шухляду не відкрито.
 */
export function AddOrderButton({
  customers,
  className,
  children,
  variant = "secondary",
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
      .select("id, name, phone, discount_percent, notes")
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
        {children ?? "Замовлення"}
      </Button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Нове замовлення" size="full">
        <OrderForm customers={customers ?? lazyCustomers} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
