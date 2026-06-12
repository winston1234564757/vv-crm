"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { SaleForm } from "@/components/forms/SaleForm";
import { IconPlus } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
  discount_percent: number;
}

interface CashRegister {
  id: string;
  name: string;
}

interface Device { id: string; brand: string | null; model: string | null; imei: string | null; price: number; status: string; }
interface Accessory { id: string; name: string; sku: string | null; price: number; stock: number; status: string; }
interface Service { id: string; name: string; price: number; status: string; }

export function AddSaleButton({
  customers,
  cashRegisters,
  devices,
  accessories,
  services,
  className = "btn-press flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover",
  children = <><IconPlus /> Новий продаж</>,
  size = "default"
}: {
  customers: Customer[];
  cashRegisters: CashRegister[];
  devices: Device[];
  accessories: Accessory[];
  services?: Service[];
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "full";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={className}
      >
        {children}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий продаж" size={size}>
        <SaleForm customers={customers} cashRegisters={cashRegisters} devices={devices} accessories={accessories} services={services} onSuccess={() => setIsOpen(false)} />
      </Drawer>
    </>
  );
}
