"use client";

import { useActionState, useEffect } from "react";
import { createDevice, updateDevice } from "@/lib/actions/inventory";
import type { ActionState } from "@/lib/actions/types";
import { Input } from "@/components/ui/Input";
import { DeviceFormData, ReplacedPart, WarehousePart } from "@/lib/types/device.types";
import { PREDEFINED_STORAGES, type StorageType } from "@/lib/types/device.types";
import { validatePart, validateWarehousePart } from "@/lib/utils/finance";

const initialState: ActionState = { success: false, error: null };

const fallbackSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23888888" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';

interface DeviceFormMainProps {
  onSuccess: () => void;
  device?: DeviceFormData;
  parts?: WarehousePart[];
  storageType: StorageType;
  setStorageType: (type: StorageType) => void;
  storageCustomValue: string;
  setStorageCustomValue: (value: string) => void;
  type: string;
  setType: (type: string) => void;
  needsRepair: boolean;
  setNeedsRepair: (needs: boolean) => void;
  repairStatus: string;
  setRepairStatus: (status: string) => void;
  repairCost: number;
  setRepairCost: (cost: number) => void;
  partsReplaced: ReplacedPart[];
  setPartsReplaced: (parts: ReplacedPart[]) => void;
  selectedPartId: string;
  setSelectedPartId: (id: string) => void;
  newPartName: string;
  setNewPartName: (name: string) => void;
  newPartCost: number;
  setNewPartCost: (cost: number) => void;
  newPartOrigin: string;
  setNewPartOrigin: (origin: string) => void;
  handleAddPart: () => void;
  handleRemovePart: (index: number) => void;
  handleSelectWarehousePart: (id: string) => void;
  photosText: string;
  setPhotosText: (text: string) => void;
  photoPreviews: string[];
  state: ActionState;
}

function DeviceFormMain({
  onSuccess,
  device,
  parts = [],
  storageType,
  setStorageType,
  storageCustomValue,
  setStorageCustomValue,
  type,
  setType,
  needsRepair,
  setNeedsRepair,
  repairStatus,
  setRepairStatus,
  repairCost,
  setRepairCost,
  partsReplaced,
  setPartsReplaced,
  selectedPartId,
  setSelectedPartId,
  newPartName,
  setNewPartName,
  newPartCost,
  setNewPartCost,
  newPartOrigin,
  setNewPartOrigin,
  handleAddPart,
  handleRemovePart,
  handleSelectWarehousePart,
  photosText,
  setPhotosText,
  photoPreviews,
  state,
}: DeviceFormMainProps) {
  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const isPredefined = device?.storage && PREDEFINED_STORAGES.includes(device.storage as (typeof PREDEFINED_STORAGES)[number]);

  return (
    <div className="space-y-5 p-2">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error}
        </div>
      )}
      
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

        {/* Add photo links section */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Посилання на фотографії (через кому)</label>
          <textarea
            name="photo_urls"
            value={photosText}
            onChange={(e) => setPhotosText(e.target.value)}
            placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg..."
            rows={2}
            className="w-full resize-none rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40"
          />

          {photoPreviews.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto py-1">
              {photoPreviews.map((url, index) => (
                <div key={index} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-warm-border/60 bg-warm-sidebar">
                  <img
                    src={url}
                    alt={`Попередній перегляд ${index + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = fallbackSvg;
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeviceFormMain;