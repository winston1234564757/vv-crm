"use client";

import { Input } from "@/components/ui/Input";
import { DeviceFormData } from "@/lib/types/device.types";
import { PREDEFINED_STORAGES, type StorageType } from "@/lib/types/device.types";
import type { ActionState } from "@/lib/actions/types";

interface DeviceFormMainProps {
  device?: DeviceFormData;
  storageType: StorageType;
  setStorageType: (type: StorageType) => void;
  storageCustomValue: string;
  setStorageCustomValue: (value: string) => void;
  type: string;
  setType: (type: string) => void;
  state: ActionState;
}

function DeviceFormMain({
  device,
  storageType,
  setStorageType,
  storageCustomValue,
  setStorageCustomValue,
  type,
  setType,
  state,
}: DeviceFormMainProps) {
  return (
    <div className="space-y-5 p-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="w-full">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Тип пристрою</label>
          <select
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
          >
            <option value="phone">Телефон (Смартфон)</option>
            <option value="tablet">Планшет</option>
            <option value="laptop">Ноутбук</option>
            <option value="watch">Годинник (Smartwatch)</option>
            <option value="other">Інше</option>
          </select>
        </div>

        <Input label="Бренд" name="brand" required placeholder="Apple, Lenovo, Samsung..." defaultValue={device?.brand ?? ""} />
        <Input label="Модель" name="model" required placeholder="iPhone 15 Pro, ThinkPad T14..." defaultValue={device?.model ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input label="IMEI / Серійний номер" name="imei" placeholder="3584XXXXXXXXXXX" defaultValue={device?.imei ?? ""} />
        <Input label="Колір" name="color" placeholder="Space Gray, Silver..." defaultValue={device?.color ?? ""} />
        
        {/* Storage selector */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Накопичувач (Storage)</label>
          <select
            value={storageType}
            onChange={(e) => setStorageType(e.target.value as StorageType)}
            className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
          >
            {PREDEFINED_STORAGES.map(storage => (
              <option key={storage} value={storage}>{storage}</option>
            ))}
            <option value="custom">Інше значення</option>
          </select>
          {storageType === "custom" && (
            <input
              type="text"
              value={storageCustomValue}
              onChange={(e) => setStorageCustomValue(e.target.value)}
              placeholder="Наприклад: 16GB, 2TB..."
              required
              className="mt-2 w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
            />
          )}
          <input 
            type="hidden" 
            name="storage" 
            value={storageType === "custom" ? storageCustomValue : storageType} 
          />
        </div>
      </div>

      {/* Dynamic specification fields */}
      {(type === "phone" || type === "tablet" || type === "watch") && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Стан АКБ (%)" name="battery_health" type="number" min="0" max="100" placeholder="85" defaultValue={device?.battery_health?.toString() ?? ""} />
          {type === "tablet" && (
            <Input label="Діагональ екрану" name="screen_size" placeholder='10.9"' defaultValue={device?.screen_size ?? ""} />
          )}
        </div>
      )}

      {(type === "laptop" || type === "tablet") && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Оперативна пам'ять (RAM)" name="ram" placeholder="8GB, 16GB, 32GB..." defaultValue={device?.ram ?? ""} />
          {type === "laptop" && (
            <>
              <Input label="Процесор (CPU)" name="cpu" placeholder="Intel Core i7, Apple M3..." defaultValue={device?.cpu ?? ""} />
              <Input label="Відеокарта (GPU)" name="gpu" placeholder="RTX 4060, Integrated..." defaultValue={device?.gpu ?? ""} />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input label="Собівартість (грн)" name="cost_price" type="number" required placeholder="12000" defaultValue={device?.cost_price.toString() ?? ""} />
        <Input label="Ціна продажу (грн)" name="price" type="number" required placeholder="15000" defaultValue={device?.price.toString() ?? ""} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Опис (опціонально)</label>
        <textarea
          name="description"
          rows={2}
          placeholder="Стан, комплектація, помітні дефекти..."
          defaultValue={device?.description ?? ""}
          className="w-full resize-none rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
        />
      </div>

      <div className="space-y-4">
        {/* Show on display */}
        <label className="flex items-center gap-3 cursor-pointer max-w-fit">
          <input 
            type="checkbox" 
            name="is_visible" 
            value="true" 
            defaultChecked={device?.is_visible ?? false} 
            className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer" 
          />
          <span className="text-sm font-medium text-text-primary">Показувати на вітрині</span>
        </label>
      </div>
    </div>
  );
}

export default DeviceFormMain;