"use client";

import { Input } from "@/components/ui/Input";
import { DeviceFormData } from "@/lib/types/device.types";

interface DeviceFormSourceProps {
  device: DeviceFormData;
}

export function DeviceFormSource({ device }: DeviceFormSourceProps) {
  return (
    <div className="border-t border-warm-border/50 pt-4">
      <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Джерело надходження</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Звідки пристрій</label>
          <select name="source" defaultValue={device?.source ?? "supplier"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer">
            <option value="supplier">Постачальник</option>
            <option value="trade_in">Trade-In</option>
            <option value="buyout">Викуп</option>
            <option value="olx">OLX</option>
            <option value="customer_return">Повернення клієнта</option>
          </select>
        </div>
        <Input label="Посилання / № оголошення" name="source_reference" placeholder="https://olx.ua/..." defaultValue={device?.source_reference ?? ""} />
        <Input label="Куплено у (кого)" name="purchased_from" placeholder="ПІБ або постачальник" defaultValue={device?.purchased_from ?? ""} />
      </div>
    </div>
  );
}

export default DeviceFormSource;