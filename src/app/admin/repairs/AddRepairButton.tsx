"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { RepairForm } from "@/components/forms/RepairForm";
import { IconPlus } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Device {
  id: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  status: string;
}

export function AddRepairButton({
  customers,
  devices,
  className = "flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover",
  children = <><IconPlus /> Новий ремонт</>,
  size = "default",
  initialDeviceId = "",
  initialIsInternal = false
}: {
  customers: Customer[];
  devices: Device[];
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "full";
  initialDeviceId?: string;
  initialIsInternal?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`btn-press ${className}`}
      >
        {children}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий ремонт" size={size}>
        <RepairForm 
          customers={customers} 
          devices={devices} 
          initialDeviceId={initialDeviceId}
          initialIsInternal={initialIsInternal}
          onSuccess={() => setIsOpen(false)} 
        />
      </Drawer>
    </>
  );
}
