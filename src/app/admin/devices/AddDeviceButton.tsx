"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { DeviceForm } from "@/components/forms/device/DeviceForm";
import { DeviceFormData } from "@/lib/types/device.types";
import { IconPlus } from "@/components/icons";
import type { Database } from "@/types/database";

export function AddDeviceButton({
  className = "flex items-center gap-1.5 rounded-xl bg-violet px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover cursor-pointer",
  children = <><IconPlus /> Додати техніку</>,
  size = "default",
  parts = []
}: {
  className?: string;
  children?: React.ReactNode;
  size?: "default" | "full" | "half";
  parts?: Database["public"]["Tables"]["parts"]["Row"][];
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Default empty device for creation mode
  const emptyDevice: DeviceFormData = {
    type: "phone",
    brand: null,
    model: null,
    storage: null,
    color: null,
    imei: null,
    battery_health: null,
    sku: null,
    price: 0,
    cost_price: 0,
    ram: null,
    screen_size: null,
    cpu: null,
    gpu: null,
    needs_repair: false,
    repair_node: null,
    repair_cost: 0,
    repair_np_ttn: null,
    repair_status: "pending",
    repair_parts_replaced: [],
    description: null,
    is_visible: true,
    source: null,
    source_reference: null,
    purchased_from: null,
    condition_grade: null,
    condition_description: null,
    original_box: null,
    accessories_included: null,
    serial_number: null,
    warehouse_location: null,
    photo_urls: null
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`btn-press ${className}`}
      >
        {children}
      </button>

      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} title="Новий пристрій" size={size}>
        <DeviceForm onSuccess={() => setIsOpen(false)} device={emptyDevice} parts={parts} />
      </Drawer>
    </>
  );
}
