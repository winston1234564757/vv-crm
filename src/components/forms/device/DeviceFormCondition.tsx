"use client";

import { Input } from "@/components/ui/Input";
import { DeviceFormData } from "@/lib/types/device.types";

interface DeviceFormConditionProps {
  device: DeviceFormData;
}

export function DeviceFormCondition({ device }: DeviceFormConditionProps) {
  return (
    <div className="border-t border-warm-border/50 pt-4">
      <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Стан пристрою</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Грейд</label>
          <select name="condition_grade" defaultValue={device?.condition_grade ?? "A"} className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer">
            <option value="new">Новий</option>
            <option value="A">Grade A (Ідеальний)</option>
            <option value="B">Grade B (Хороший)</option>
            <option value="C">Grade C (Середній)</option>
            <option value="for_repair">Під ремонт</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Опис стану</label>
          <input name="condition_description" defaultValue={device?.condition_description ?? ""} placeholder="Подряпини, сліди використання..." className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mt-4">
        <label className="flex items-center gap-3 cursor-pointer max-w-fit">
          <input type="checkbox" name="original_box" value="true" defaultChecked={device?.original_box ?? false} className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer" />
          <span className="text-sm font-medium text-text-primary">В оригінальній коробці</span>
        </label>
        <Input label="Комплектація" name="accessories_included" placeholder="Зарядка, кабель..." defaultValue={device?.accessories_included ?? ""} />
        <Input label="Серійний номер (S/N)" name="serial_number" placeholder="F2LZ..." defaultValue={device?.serial_number ?? ""} />
      </div>
      <div className="mt-4">
        <Input label="Розташування на складі" name="warehouse_location" placeholder="Стелаж А, полиця 3" defaultValue={device?.warehouse_location ?? ""} />
      </div>
    </div>
  );
}

export default DeviceFormCondition;