"use client";

import { useState } from "react";
import { RepairsTable } from "./table";
import { AddRepairButton } from "./AddRepairButton";
import { IconBox, IconPlus } from "@/components/icons";
import GlassCard from "@/components/GlassCard";
import Drawer from "@/components/ui/Drawer";
import { RepairForm } from "@/components/forms/RepairForm";
import { pluralUk } from "@/lib/utils/plural";

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
  needs_repair?: boolean;
  repair_node?: string | null;
  repair_cost?: number;
}

export interface RepairRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_telegram: string | null;
  device_name: string;
  device_imei: string | null;
  device_password?: string | null;
  device_accessories_included?: string | null;
  device_condition?: string | null;
  device_condition_description?: string | null;
  device_condition_photos?: string[] | null;
  issue: string;
  issue_nodes?: string[] | null;
  issue_diagnostics?: string[] | null;
  status: string;
  payment_status: string | null;
  source: string | null;
  price: number;
  cost: number;
  warranty_months: number;
  notes: string | null;
  np_ttn: string | null;
  is_external_sc: boolean;
  external_sc_cost: number;
  markup_amount: number;
  created_at: string;
  estimated_completion?: string | null;
}

const nodeLabels: Record<string, string> = {
  display: "Дисплей", battery: "Акумулятор", charging_port: "Порт зарядки",
  speaker: "Динамік/Мікрофон", camera: "Камера", button: "Кнопки",
  housing: "Корпус", water_damage: "Волога", software: "ПЗ/Прошивка", other_node: "Інше",
};

export function RepairsClient({
  customerRepairs,
  internalRepairs,
  devicesNeedingRepair,
  customers,
  inStockDevices,
}: {
  customerRepairs: RepairRow[];
  internalRepairs: RepairRow[];
  devicesNeedingRepair: Device[];
  customers: Customer[];
  inStockDevices: Device[];
}) {
  const [activeTab, setActiveTab] = useState<"customer" | "internal">("customer");
  const [selectedDeviceForRepair, setSelectedDeviceForRepair] = useState<Device | null>(null);

  // Active repairs counts
  const activeCustomerCount = customerRepairs.filter(
    (r) => !["completed", "handed_over", "cancelled"].includes(r.status)
  ).length;

  const activeInternalCount = internalRepairs.filter(
    (r) => !["completed", "handed_over", "cancelled"].includes(r.status)
  ).length;

  // Filter out devices needing repair that already have an active internal repair
  const activeInternalDeviceIds = new Set(
    internalRepairs
      .filter((r) => !["completed", "handed_over", "cancelled"].includes(r.status))
      .map((r) => r.device_imei) // Matching by IMEI is safest, fallback to device_name comparison if IMEI is null
  );

  const pendingDevicesToRepair = devicesNeedingRepair.filter(
    (d) => !d.imei || !activeInternalDeviceIds.has(d.imei)
  );

  const totalWarehouseRepairsCount = internalRepairs.length + pendingDevicesToRepair.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Ремонти</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {activeTab === "customer" && `${customerRepairs.length} ${pluralUk(customerRepairs.length, "заявка", "заявки", "заявок")} від клієнтів`}
            {activeTab === "internal" && `${totalWarehouseRepairsCount} ${pluralUk(totalWarehouseRepairsCount, "пристрій", "пристрої", "пристроїв")} на складі`}
          </p>
        </div>
        <div className="flex gap-2">
          <AddRepairButton customers={customers} devices={inStockDevices} />
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-iris/10 gap-6">
        <button
          onClick={() => setActiveTab("customer")}
          className={`pb-3 text-sm font-semibold relative transition-colors ${
            activeTab === "customer" ? "text-violet" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          👤 Клієнтські ремонти
          {activeCustomerCount > 0 && (
            <span className="ml-1.5 rounded-full bg-violet/10 px-1.5 py-0.5 text-xxs font-bold text-violet">
              {activeCustomerCount}
            </span>
          )}
          {activeTab === "customer" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("internal")}
          className={`pb-3 text-sm font-semibold relative transition-colors ${
            activeTab === "internal" ? "text-violet" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          📦 Ремонти складу
          {(activeInternalCount > 0 || pendingDevicesToRepair.length > 0) && (
            <span className="ml-1.5 rounded-full bg-violet/10 px-1.5 py-0.5 text-xxs font-bold text-violet">
              {activeInternalCount + pendingDevicesToRepair.length}
            </span>
          )}
          {activeTab === "internal" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet rounded-t-full" />
          )}
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">
            {activeTab === "customer" ? "Активні ремонти" : "Активні + Очікують старту"}
          </p>
          <p className="mt-2 text-3xl font-light tracking-tight text-text-primary">
            {activeTab === "customer"
              ? activeCustomerCount
              : activeInternalCount + pendingDevicesToRepair.length}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Готові до видачі / переміщення</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-cyan">
            {activeTab === "customer"
              ? customerRepairs.filter((r) => r.status === "ready").length
              : internalRepairs.filter((r) => r.status === "ready").length}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs font-medium tracking-wider text-text-secondary">Очікують деталі</p>
          <p className="mt-2 text-3xl font-light tracking-tight text-rose">
            {activeTab === "customer"
              ? customerRepairs.filter((r) => r.status === "awaiting_parts").length
              : internalRepairs.filter((r) => r.status === "awaiting_parts").length}
          </p>
        </GlassCard>
      </div>

      {/* Lists / Tables */}
      {activeTab === "customer" ? (
        <GlassCard>
          <RepairsTable repairs={customerRepairs} />
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Requires servicing (Start servicing action) */}
          {pendingDevicesToRepair.length > 0 && (
            <GlassCard className="border border-amber/20 bg-amber/[0.01]">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <span className="text-amber">⚠️</span> Очікують початку ремонту (техніка на складі)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                      <th className="pb-2 pr-4">Пристрій</th>
                      <th className="pb-2 pr-4">IMEI</th>
                      <th className="pb-2 pr-4">Статус</th>
                      <th className="pb-2 pr-4">Вузол поломки</th>
                      <th className="pb-2 pr-4 text-right">Очікувані витрати</th>
                      <th className="pb-2 text-right">Дія</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDevicesToRepair.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-iris/5 text-text-primary transition-colors hover:bg-amber/[0.02]"
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          <span className="flex items-center gap-2">
                            <span className="text-text-secondary"><IconBox size={16} /></span>
                            {d.brand} {d.model}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-text-secondary font-mono text-xs">
                          {d.imei || "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-semibold text-amber">
                            Потребує ремонту
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-text-secondary">
                          {d.repair_node ? (nodeLabels[d.repair_node] || d.repair_node) : "Не вказано"}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-medium text-text-primary">
                          {(d.repair_cost || 0).toLocaleString()} грн
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => setSelectedDeviceForRepair(d)}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-hover"
                          >
                            <IconPlus size={12} /> Почати ремонт
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Section 2: Active & completed servicing records */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
              <span>📋</span> Активні та архівні ремонти складу
            </h3>
            <RepairsTable repairs={internalRepairs} />
          </GlassCard>
        </div>
      )}

      {/* Start Repair Drawer */}
      <Drawer
        isOpen={!!selectedDeviceForRepair}
        onClose={() => setSelectedDeviceForRepair(null)}
        title="Створити внутрішній ремонт"
      >
        {selectedDeviceForRepair && (
          <RepairForm
            customers={customers}
            devices={inStockDevices}
            initialDeviceId={selectedDeviceForRepair.id}
            initialIsInternal={true}
            onSuccess={() => {
              setSelectedDeviceForRepair(null);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
