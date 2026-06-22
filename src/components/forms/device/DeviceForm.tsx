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