"use client";

import Link from "next/link";
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
  className = "btn-press flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover",
  children = <><IconPlus /> Новий продаж</>,
}: {
  customers?: Customer[];
  cashRegisters?: CashRegister[];
  devices?: Device[];
  accessories?: Accessory[];
  services?: Service[];
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "full";
}) {
  return (
    <Link 
      href="/admin/sales/pos"
      className={className}
    >
      {children}
    </Link>
  );
}
