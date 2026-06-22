"use client";

import DeviceFormMain from "./DeviceFormMain";
import DeviceFormPhotos from "./DeviceFormPhotos";
import DeviceFormSource from "./DeviceFormSource";
import DeviceFormCondition from "./DeviceFormCondition";
import DeviceFormRepair from "./DeviceFormRepair";
import DeviceFormSubmit from "./DeviceFormSubmit";
import { DeviceFormData, WarehousePart } from "@/lib/types/device.types";
import { useDeviceForm } from "./useDeviceForm";

import type { Database } from "@/types/database";

interface DeviceFormProps {
  onSuccess: () => void;
  device: DeviceFormData;
  parts?: WarehousePart[];
  safes?: Database["public"]["Tables"]["safes"]["Row"][];
}

export function DeviceForm({ onSuccess, device, parts = [], safes = [] }: DeviceFormProps) {
  const form = useDeviceForm({ onSuccess, device, parts });

  return (
    <form action={form.formAction} className="space-y-5 p-2">
      {form.state.error && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-sm rounded-xl border border-rose/30 bg-warm-surface p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <span className="text-rose text-base mt-0.5">⚠️</span>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">{form.state.error}</p>
              {form.state.error.toLowerCase().includes("недостатньо коштів") && (
                <div className="pt-1">
                  <a
                    href="/admin/finance"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-hover cursor-pointer"
                  >
                    Перейти до фінансів ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeviceFormMain
        device={device}
        storageType={form.storageTypeState}
        setStorageType={form.setStorageTypeState}
        storageCustomValue={form.storageCustomValue}
        setStorageCustomValue={form.setStorageCustomValue}
        type={form.type}
        setType={form.setType}
        state={form.state}
      />

      <DeviceFormPhotos device={device} />

      <DeviceFormSource device={device} safes={safes} />

      <DeviceFormCondition device={device} />

      <DeviceFormRepair
        device={device}
        needsRepair={form.needsRepair}
        setNeedsRepair={form.setNeedsRepair}
        repairStatus={form.repairStatus}
        setRepairStatus={form.setRepairStatus}
        repairCost={form.repairCost}
        setRepairCost={form.setRepairCost}
        partsReplaced={form.partsReplaced}
        setPartsReplaced={form.setPartsReplaced}
        selectedPartId={form.selectedPartId}
        setSelectedPartId={form.setSelectedPartId}
        newPartName={form.newPartName}
        setNewPartName={form.setNewPartName}
        newPartCost={form.newPartCost}
        setNewPartCost={form.setNewPartCost}
        newPartOrigin={form.newPartOrigin}
        setNewPartOrigin={form.setNewPartOrigin}
        handleAddPart={form.handleAddPart}
        handleRemovePart={form.handleRemovePart}
        handleSelectWarehousePart={form.handleSelectWarehousePart}
        parts={parts}
      />

      <DeviceFormSubmit pending={form.pending} device={device} />
    </form>
  );
}