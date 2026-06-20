"use client";

import { useActionState, useState, useEffect, useMemo } from "react";
import { createDevice, updateDevice } from "@/lib/actions/inventory";
import type { ActionState } from "@/lib/actions/types";
import {
  DeviceFormData,
  ReplacedPart,
  StorageType,
  WarehousePart,
  RepairPartsData,
  PREDEFINED_STORAGES,
} from "@/lib/types/device.types";
import { validatePart, validateWarehousePart } from "@/lib/utils/finance";

const initialState: ActionState = { success: false, error: null };

interface UseDeviceFormProps {
  onSuccess: () => void;
  device: DeviceFormData;
  parts?: WarehousePart[];
}

export function useDeviceForm({ onSuccess, device, parts = [] }: UseDeviceFormProps) {
  const action = device.id ? updateDevice.bind(null, device.id) : createDevice;
  const [state, formAction, pending] = useActionState(action, initialState);

  const deviceProperties = useMemo(() => {
    return {
      type: device.type ?? "phone",
      needsRepair: device.needs_repair ?? false,
      repairStatus: device.repair_status ?? "pending",
      repairCost: device.repair_cost ?? 0,
    };
  }, [device]);

  const [type, setType] = useState<string>(deviceProperties.type);
  const [needsRepair, setNeedsRepair] = useState<boolean>(deviceProperties.needsRepair);
  const [repairStatus, setRepairStatus] = useState<string>(deviceProperties.repairStatus);
  const [repairCost, setRepairCost] = useState<number>(deviceProperties.repairCost);
  const [partsReplaced, setPartsReplaced] = useState<ReplacedPart[]>(
    Array.isArray(device?.repair_parts_replaced)
      ? (device.repair_parts_replaced as RepairPartsData[]).map((p) => ({
          name: String(p?.name || ""),
          cost: Number(p?.cost || 0),
          origin: String(p?.origin || ""),
        }))
      : []
  );
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [newPartName, setNewPartName] = useState<string>("");
  const [newPartCost, setNewPartCost] = useState<number>(0);
  const [newPartOrigin, setNewPartOrigin] = useState<string>("Copy");

  const isPredefined =
    device?.storage &&
    PREDEFINED_STORAGES.includes(device.storage as (typeof PREDEFINED_STORAGES)[number]);
  const storageType: StorageType =
    device?.storage === ""
      ? "128GB"
      : isPredefined
      ? (device.storage as StorageType)
      : "custom";
  const [storageTypeState, setStorageTypeState] = useState<StorageType>(storageType);
  const [storageCustomValue, setStorageCustomValue] = useState<string>(
    isPredefined ? "" : device?.storage ?? ""
  );

  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    const added = {
      name: newPartName.trim(),
      cost: newPartCost,
      origin: newPartOrigin,
    };
    try {
      validatePart(added);
      setPartsReplaced((prev) => [...prev, added]);
      setRepairCost((prev) => prev + newPartCost);
      setSelectedPartId("");
      setNewPartName("");
      setNewPartCost(0);
      setNewPartOrigin("Copy");
    } catch (error) {
      console.error("Invalid part:", error);
    }
  };

  const handleRemovePart = (index: number) => {
    const partToRemove = partsReplaced[index];
    setPartsReplaced((prev) => prev.filter((_, i) => i !== index));
    setRepairCost((prev) => Math.max(0, prev - partToRemove.cost));
  };

  const handleSelectWarehousePart = (id: string) => {
    setSelectedPartId(id);
    if (id === "custom" || id === "") {
      setNewPartName("");
      setNewPartCost(0);
      setNewPartOrigin("Copy");
      return;
    }
    const p = parts.find((x) => x.id === id);
    if (p) {
      try {
        const parsed = validateWarehousePart(p);
        setNewPartName(parsed.name);
        setNewPartCost(parsed.cost_price);
        setNewPartOrigin(parsed.origin_type || "Copy");
      } catch (error) {
        console.error("Invalid warehouse part:", error);
      }
    }
  };

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  return {
    state,
    formAction,
    pending,
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
    storageTypeState,
    setStorageTypeState,
    storageCustomValue,
    setStorageCustomValue,
    handleAddPart,
    handleRemovePart,
    handleSelectWarehousePart,
  };
}
