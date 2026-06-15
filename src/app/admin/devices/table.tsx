"use client";

import { useState } from "react";
import { 
  IconSearch, 
  IconEdit, 
  IconDelete, 
  IconFilter, 
  IconDevice,
  IconGrid,
  IconBox,
  IconRepair,
  IconWarning,
  IconTruck
} from "@/components/icons";

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function IconCheck({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
import { deleteDevice, updateDeviceStatus, bulkUpdateDevicesStatus, bulkUpdateDevicesTtn } from "@/lib/actions/inventory";
import Drawer from "@/components/ui/Drawer";
import { DeviceForm } from "@/components/forms/device/DeviceForm";
import { DeviceDetailView } from "@/components/DeviceDetailView";
import { SaleForm } from "@/components/forms/SaleForm";
import { InlineError } from "@/components/ui/InlineError";
import { motion } from "framer-motion";
import type { Database } from "@/types/database";

type DbDeviceRow = Database["public"]["Tables"]["devices"]["Row"];
export type DeviceRow = Omit<DbDeviceRow, "repair_parts_replaced"> & {
  repair_parts_replaced: { name: string; cost: number; origin: string }[] | null;
};


const typeLabels: Record<string, string> = { 
  phone: "Телефон", 
  tablet: "Планшет", 
  laptop: "Ноутбук", 
  watch: "Годинник", 
  other: "Інше" 
};

const sourceLabels: Record<string, string> = {
  supplier: "Постачальник", 
  trade_in: "Trade-In", 
  buyout: "Викуп",
  olx: "OLX", 
  marketplace: "Маркетплейс", 
  customer_return: "Повернення", 
  other: "Інше",
};

const conditionLabels: Record<string, string> = {
  perfect: "Grade A (Ідеальний)", 
  good: "Grade B (Хороший)", 
  fair: "Grade C (Середній)", 
  poor: "Поганий",
  damaged: "Під ремонт / Пошкоджений",
};

const conditionColors: Record<string, string> = {
  perfect: "text-cyan bg-cyan/10", 
  good: "text-violet bg-violet/10", 
  fair: "text-amber bg-amber/10", 
  poor: "text-rose bg-rose/10",
  damaged: "text-rose bg-rose/10",
};

const statusColors: Record<string, string> = { 
  in_stock: "var(--color-cyan)", 
  transit: "var(--color-violet)",
  sold: "var(--color-iris)", 
  service: "var(--color-amber)", 
  returned: "var(--color-rose)", 
  archived: "var(--color-iris)" 
};

const statusLabels: Record<string, string> = { 
  in_stock: "В наявності", 
  transit: "В дорозі",
  sold: "Продано", 
  service: "В ремонті", 
  returned: "Повернення", 
  archived: "Архів" 
};

import type { getInternalRepairs } from "@/lib/data-repairs";

interface DevicesTableProps {
  devices: DeviceRow[];
  customers: Database["public"]["Tables"]["customers"]["Row"][];
  cashRegisters: Database["public"]["Tables"]["cash_registers"]["Row"][];
  accessories: Database["public"]["Tables"]["accessories"]["Row"][];
  services: Database["public"]["Tables"]["services"]["Row"][];
  parts: Database["public"]["Tables"]["parts"]["Row"][];
  repairs?: Awaited<ReturnType<typeof getInternalRepairs>>;
}

export function DevicesTable({ 
  devices, 
  customers, 
  cashRegisters, 
  accessories, 
  services,
  parts,
  repairs = []
}: DevicesTableProps) {
  const [activeTab, setActiveTab] = useState<"kanban" | "archive">("kanban");
  
  // Фільтри та пошук
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  
  // Модальні вікна / Drawer
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [sellingDevice, setSellingDevice] = useState<DeviceRow | null>(null);
  
  // Помилки та успіх
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  
  // Bulk Selection
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [bulkTtn, setBulkTtn] = useState("");

  async function handleDelete(id: string) {
    if (!confirm("Видалити цей пристрій?")) return;
    const res = await deleteDevice(id);
    if (!res.success) setError(res.error ?? "");
  }

  async function handleStatusChange(
    id: string, 
    newStatus: "in_stock" | "transit" | "service" | "sold" | "returned" | "archived",
    repairStatus?: "pending" | "waiting_parts" | "in_progress" | "completed"
  ) {
    setPendingId(id);
    const res = await updateDeviceStatus(id, newStatus, repairStatus);
    setPendingId(null);
    if (!res.success) setError(res.error ?? "");
  }

  async function handleBulkStatusChange(status: "in_stock" | "transit" | "service" | "sold" | "returned" | "archived") {
    if (selectedDeviceIds.length === 0) return;
    setPendingId("bulk");
    const res = await bulkUpdateDevicesStatus(selectedDeviceIds, status);
    setPendingId(null);
    if (res.success) {
      setSelectedDeviceIds([]);
    } else {
      setError(res.error || "Помилка оновлення статусу");
    }
  }

  async function handleBulkDevicesTtn() {
    if (selectedDeviceIds.length === 0 || !bulkTtn) return;
    setPendingId("bulk");
    const res = await bulkUpdateDevicesTtn(selectedDeviceIds, bulkTtn);
    setPendingId(null);
    if (res.success) {
      setSelectedDeviceIds([]);
      setBulkTtn("");
    } else {
      setError(res.error || "Помилка оновлення ТТН");
    }
  }

  // Динамічний список брендів з наявних пристроїв
  const uniqueBrands = Array.from(
    new Set(devices.map((d) => d.brand).filter(Boolean))
  ).sort() as string[];

  // Фільтрація пристроїв
  const filtered = devices.filter((d) => {
    // 1. Поділ за вкладками
    const isActive = d.status === "transit" || d.status === "in_stock" || d.status === "service";
    if (activeTab === "kanban" && !isActive) return false;
    if (activeTab === "archive" && isActive) return false;

    // 2. Пошук
    if (query) {
      const q = query.toLowerCase();
      const matchesQuery = 
        (d.brand ?? "").toLowerCase().includes(q) || 
        (d.model ?? "").toLowerCase().includes(q) || 
        (d.imei ?? "").includes(q) || 
        (d.storage ?? "").toLowerCase().includes(q) || 
        (d.source ?? "").toLowerCase().includes(q);
      if (!matchesQuery) return false;
    }

    // 3. Розширені фільтри
    if (filterType !== "all" && d.type !== filterType) return false;
    if (filterBrand !== "all" && d.brand !== filterBrand) return false;
    if (filterCondition !== "all" && d.condition_grade !== filterCondition) return false;

    return true;
  });

  // Групування для Канбану
  const transitDevices = filtered.filter((d) => d.status === "transit");
  const inStockDevices = filtered.filter((d) => d.status === "in_stock");
  const serviceDevices = filtered.filter((d) => d.status === "service");

  const hasActiveFilters = filterType !== "all" || filterBrand !== "all" || filterCondition !== "all";

  const handleResetFilters = () => {
    setFilterType("all");
    setFilterBrand("all");
    setFilterCondition("all");
    setQuery("");
  };

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />

      {/* BULK ACTIONS PANEL */}
      {selectedDeviceIds.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-violet/5 border border-violet/20 p-4 animate-entry mb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet text-white text-xxs font-bold">
              {selectedDeviceIds.length}
            </span>
            <span className="text-xs font-semibold text-text-primary">техніки обрано для групових дій</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === "kanban" && (
              <>
                <button
                  onClick={() => handleBulkStatusChange("in_stock")}
                  disabled={pendingId === "bulk"}
                  className="rounded-xl bg-violet hover:bg-violet-hover text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Отримати на склад (In Stock)
                </button>
                <button
                  onClick={() => handleBulkStatusChange("service")}
                  disabled={pendingId === "bulk"}
                  className="rounded-xl bg-amber hover:bg-amber-hover text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Передати в ремонт (Service)
                </button>
                <div className="h-6 w-px bg-iris/20 hidden sm:block mx-1" />
              </>
            )}
            
            <input
              type="text"
              value={bulkTtn}
              onChange={(e) => setBulkTtn(e.target.value)}
              placeholder="ТТН закупівлі..."
              className="rounded-xl border border-warm-border bg-white px-3.5 py-2 text-xs text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 min-w-[150px]"
            />
            <button
              onClick={handleBulkDevicesTtn}
              disabled={pendingId === "bulk" || !bulkTtn}
              className="rounded-xl bg-violet hover:bg-violet-hover text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
            >
              Задати ТТН
            </button>
            <button
              onClick={() => { setSelectedDeviceIds([]); setBulkTtn(""); }}
              className="rounded-xl border border-warm-border bg-white hover:bg-warm-hover text-text-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* Шапка з вкладками */}
      <div className="flex flex-col gap-4 border-b border-warm-border pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 p-1 bg-warm-sidebar rounded-xl border border-warm-border max-w-fit">
          <button
            onClick={() => {
              setActiveTab("kanban");
              handleResetFilters();
              setSelectedDeviceIds([]);
            }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "kanban"
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <IconGrid size={14} />
            <span>Дошка (Активні)</span>
            <span className="bg-violet/10 text-violet text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {devices.filter(d => d.status === "transit" || d.status === "in_stock" || d.status === "service").length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("archive");
              handleResetFilters();
              setSelectedDeviceIds([]);
            }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "archive"
                ? "bg-white text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <IconBox size={14} />
            <span>Архів / Продані</span>
            <span className="bg-text-secondary/10 text-text-secondary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {devices.filter(d => d.status === "sold" || d.status === "returned" || d.status === "archived").length}
            </span>
          </button>
        </div>

        {/* Панель пошуку та швидких фільтрів */}
        <div className="flex flex-1 items-center gap-2 max-w-lg md:justify-end">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
              <IconSearch />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Пошук моделі, IMEI..."
              className="w-full rounded-xl border border-warm-border bg-warm-surface pl-9 pr-4 py-2 text-xs text-text-primary placeholder-text-muted outline-none transition-colors focus:border-violet/40"
            />
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 rounded-xl border px-4.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              showAdvanced || hasActiveFilters
                ? "border-violet/30 bg-violet/10 text-violet"
                : "border-warm-border bg-warm-surface text-text-secondary hover:bg-violet/5 hover:text-text-primary"
            }`}
          >
            <IconFilter size={14} />
            <span>Фільтри</span>
            {hasActiveFilters && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-violet animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Панель розширеної фільтрації */}
      {showAdvanced && (
        <div className="mt-4 rounded-xl border border-warm-border bg-warm-sidebar/30 p-4 animate-entry">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Категорія */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Категорія</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-lg border border-warm-border bg-warm-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
              >
                <option value="all">Усі категорії</option>
                {Object.entries(typeLabels).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>

            {/* Бренд */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Бренд</label>
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="w-full rounded-lg border border-warm-border bg-warm-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
              >
                <option value="all">Усі бренди</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Стан */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Стан пристрою</label>
              <select
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                className="w-full rounded-lg border border-warm-border bg-warm-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
              >
                <option value="all">Усі стани</option>
                {Object.entries(conditionLabels).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="rounded-lg bg-rose/5 px-3 py-1.5 text-xs font-semibold text-rose hover:bg-rose/10 transition-colors cursor-pointer"
              >
                Скинути фільтри
              </button>
            </div>
          )}
        </div>
      )}

      {/* ВМІСТ ВКЛАДОК */}
      <div className="mt-5">
        {activeTab === "kanban" ? (
          /* ============================================================
             КАНБАН ДОШКА (3 КОЛОНКИ: В дорозі, В наявності, В ремонті)
             ============================================================ */
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* 1. В ДОРОЗІ */}
            <div className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/10 p-3 min-h-[500px]">
              <div className="mb-3 flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <IconTruck size={14} className="text-violet shrink-0" />
                  <span>В дорозі (Transit)</span>
                </h3>
                <span className="rounded-full bg-violet-subtle text-violet px-2.5 py-0.5 text-xs font-semibold">
                  {transitDevices.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {transitDevices.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-12">Немає пристроїв у дорозі</p>
                ) : (
                  transitDevices.map((d) => (
                    <KanbanCard 
                      key={d.id} 
                      device={d} 
                      onEdit={(dev) => { setSelectedDevice(dev); setIsEditingDevice(true); }}
                      onDelete={handleDelete}
                      onCardClick={(dev) => { setSelectedDevice(dev); setIsEditingDevice(false); }}
                      pending={pendingId === d.id}
                      isSelected={selectedDeviceIds.includes(d.id)}
                      onSelectToggle={(id) => {
                        if (selectedDeviceIds.includes(id)) {
                          setSelectedDeviceIds(selectedDeviceIds.filter(x => x !== id));
                        } else {
                          setSelectedDeviceIds([...selectedDeviceIds, id]);
                        }
                      }}
                      actions={
                        <button
                          onClick={() => handleStatusChange(d.id, "in_stock")}
                          disabled={pendingId === d.id}
                          className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <IconDownload size={14} />
                          <span>Отримати на склад</span>
                        </button>
                      }
                    />
                  ))
                )}
              </div>
            </div>

            {/* 2. В НАЯВНОСТІ */}
            <div className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/10 p-3 min-h-[500px]">
              <div className="mb-3 flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan shrink-0 animate-pulse" />
                  <span>В наявності (In Stock)</span>
                </h3>
                <span className="rounded-full bg-cyan/10 text-cyan px-2.5 py-0.5 text-xs font-semibold">
                  {inStockDevices.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {inStockDevices.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-12">Склад порожній</p>
                ) : (
                  inStockDevices.map((d) => (
                    <KanbanCard 
                      key={d.id} 
                      device={d} 
                      onEdit={(dev) => { setSelectedDevice(dev); setIsEditingDevice(true); }}
                      onDelete={handleDelete}
                      onCardClick={(dev) => { setSelectedDevice(dev); setIsEditingDevice(false); }}
                      onStatusChange={handleStatusChange}
                      pending={pendingId === d.id}
                      isSelected={selectedDeviceIds.includes(d.id)}
                      onSelectToggle={(id) => {
                        if (selectedDeviceIds.includes(id)) {
                          setSelectedDeviceIds(selectedDeviceIds.filter(x => x !== id));
                        } else {
                          setSelectedDeviceIds([...selectedDeviceIds, id]);
                        }
                      }}
                      actions={
                        <div className="flex gap-2 w-full">
                          {!(d.needs_repair && (d.repair_status === "completed" || d.repair_status === "handed_over")) && (
                            <button
                              onClick={() => handleStatusChange(d.id, "service")}
                              disabled={pendingId === d.id}
                              className="btn-press flex-1 rounded-xl border border-amber/25 bg-amber/5 py-2 text-xs font-semibold text-amber transition-colors hover:bg-amber/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <IconRepair size={14} />
                              <span>В ремонт</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSellingDevice(d)}
                            disabled={pendingId === d.id}
                            className="btn-press flex-1 rounded-xl bg-violet py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            <IconCash size={14} />
                            <span>Продати</span>
                          </button>
                        </div>
                      }
                    />
                  ))
                )}
              </div>
            </div>

            {/* 3. В РЕМОНТІ */}
            <div className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/10 p-3 min-h-[500px]">
              <div className="mb-3 flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-amber shrink-0 flex items-center">
                    <IconRepair size={14} />
                  </span>
                  <span>В ремонті (Service)</span>
                </h3>
                <span className="rounded-full bg-amber/10 text-amber px-2.5 py-0.5 text-xs font-semibold">
                  {serviceDevices.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto">
                {serviceDevices.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-12">Немає пристроїв у ремонті</p>
                ) : (
                  serviceDevices.map((d) => (
                    <KanbanCard 
                      key={d.id} 
                      device={d} 
                      onEdit={(dev) => { setSelectedDevice(dev); setIsEditingDevice(true); }}
                      onDelete={handleDelete}
                      onCardClick={(dev) => { setSelectedDevice(dev); setIsEditingDevice(false); }}
                      pending={pendingId === d.id}
                      isSelected={selectedDeviceIds.includes(d.id)}
                      onSelectToggle={(id) => {
                        if (selectedDeviceIds.includes(id)) {
                          setSelectedDeviceIds(selectedDeviceIds.filter(x => x !== id));
                        } else {
                          setSelectedDeviceIds([...selectedDeviceIds, id]);
                        }
                      }}
                      actions={
                        <button
                          onClick={() => handleStatusChange(d.id, "in_stock", "completed")}
                          disabled={pendingId === d.id}
                          className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-hover disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <IconCheck size={14} />
                          <span>Ремонт виконано (На склад)</span>
                        </button>
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================
             АРХІВ / ПРОДАНІ (ТАБЛИЦЯ)
             ============================================================ */
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-16">Архів порожній або нічого не знайдено</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warm-border text-left text-xs font-semibold text-text-secondary">
                    <th className="pb-3 pr-4 w-10">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && selectedDeviceIds.length === filtered.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDeviceIds(filtered.map(x => x.id));
                          } else {
                            setSelectedDeviceIds([]);
                          }
                        }}
                        className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                      />
                    </th>
                    <th className="pb-3 pr-4">Модель / Категорія</th>
                    <th className="pb-3 pr-4">Характеристики</th>
                    <th className="pb-3 pr-4">Стан</th>
                    <th className="pb-3 pr-4">IMEI</th>
                    <th className="pb-3 pr-4">Джерело</th>
                    <th className="pb-3 pr-4 text-right">Ціна продажу</th>
                    <th className="pb-3 pr-4 text-right">Собівартість</th>
                    <th className="pb-3 pr-4 text-right">Статус</th>
                    <th className="pb-3 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const totalCost = d.cost_price + (d.needs_repair ? d.repair_cost : 0);
                    const isSelected = selectedDeviceIds.includes(d.id);
                    return (
                      <tr 
                        key={d.id} 
                        onClick={() => { setSelectedDevice(d); setIsEditingDevice(false); }}
                        className={`border-b border-warm-border/50 text-text-primary transition-colors cursor-pointer ${isSelected ? "bg-violet/[0.04]" : "hover:bg-violet/[0.01]"}`}
                      >
                        <td className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDeviceIds([...selectedDeviceIds, d.id]);
                              } else {
                                setSelectedDeviceIds(selectedDeviceIds.filter(x => x !== d.id));
                              }
                            }}
                            className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                          />
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          <div>{d.brand} {d.model}</div>
                          <span className="text-[9px] text-text-secondary bg-warm-sidebar px-2 py-0.5 rounded uppercase">
                            {typeLabels[d.type] || d.type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-text-secondary space-y-0.5">
                          {d.storage && <div>Нак.: <span className="text-text-primary font-medium">{d.storage}</span></div>}
                          {d.ram && <div>ОЗУ: <span className="text-text-primary font-medium">{d.ram}</span></div>}
                          {d.battery_health && <div>АКБ: <span className="text-text-primary font-medium">{d.battery_health}%</span></div>}
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          <span className={`rounded-md px-2 py-0.5 font-medium ${conditionColors[d.condition_grade ?? ""] || "bg-warm-sidebar text-text-secondary"}`}>
                            {conditionLabels[d.condition_grade ?? ""] || "—"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-text-secondary">{d.imei || "—"}</td>
                        <td className="py-3 pr-4 text-xs text-text-secondary">
                          {sourceLabels[d.source ?? ""] || d.source || "—"}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium">{d.price.toLocaleString()} грн</td>
                        <td className="py-3 pr-4 text-right text-text-secondary">
                          <div>{totalCost.toLocaleString()} грн</div>
                          {d.needs_repair && d.repair_cost > 0 && (
                            <div className="text-[9px] text-text-muted">({d.cost_price} + {d.repair_cost} рем.)</div>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span 
                            className="rounded-lg px-2.5 py-0.5 text-[10px] font-semibold" 
                            style={{ 
                              background: `color-mix(in oklch, ${statusColors[d.status]} 18%, transparent)`, 
                              color: statusColors[d.status] 
                            }}
                          >
                            {statusLabels[d.status] || d.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {d.status !== 'transit' && (
                              <button
                                onClick={() => handleStatusChange(d.id, "transit")}
                                className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet cursor-pointer"
                                title="Повернути в дорогу"
                              >
                                <IconTruck size={16} />
                              </button>
                            )}
                             <button
                               onClick={(e) => { e.stopPropagation(); setSelectedDevice(d); setIsEditingDevice(true); }}
                               className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-violet/5 hover:text-violet cursor-pointer"
                               title="Редагувати"
                             >
                              <IconEdit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(d.id)}
                              className="btn-press flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose cursor-pointer"
                              title="Видалити"
                            >
                              <IconDelete size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* DRAWER: ПЕРЕГЛЯД ТА РЕДАГУВАННЯ ПРИСТРОЮ */}
      <Drawer 
        isOpen={!!selectedDevice} 
        onClose={() => { setSelectedDevice(null); setIsEditingDevice(false); }} 
        title={isEditingDevice ? "Редагувати пристрій" : "Деталі пристрою"} 
        size="half"
      >
        {selectedDevice && (
          isEditingDevice ? (
            <DeviceForm 
              onSuccess={() => { setSelectedDevice(null); setIsEditingDevice(false); }} 
              device={selectedDevice} 
              parts={parts} 
            />
          ) : (
            <DeviceDetailView 
              device={selectedDevice} 
              onEdit={() => setIsEditingDevice(true)} 
              onSell={() => { setSellingDevice(selectedDevice); setSelectedDevice(null); }}
              onClose={() => setSelectedDevice(null)} 
              repairs={repairs.filter(r => r.inventory_device_id === selectedDevice.id)}
            />
          )
        )}
      </Drawer>

      {/* DRAWER: ОФОРМЛЕННЯ ШВИДКОГО ПРОДАЖУ */}
      <Drawer isOpen={!!sellingDevice} onClose={() => setSellingDevice(null)} title="Швидкий продаж техніки" size="default">
        {sellingDevice && (
          <SaleForm 
            customers={customers} 
            cashRegisters={cashRegisters} 
            devices={devices} 
            accessories={accessories} 
            services={services} 
            initialCategory="device"
            initialItemId={sellingDevice.id}
            onSuccess={() => {
              setSellingDevice(null);
            }} 
          />
        )}
      </Drawer>
    </>
  );
}

/* ============================================================
   КАРТКА КАНБАНУ (KANBAN CARD COMPONENT)
   ============================================================ */
function KanbanCard({ 
  device, 
  onEdit, 
  onDelete, 
  onCardClick,
  onStatusChange,
  pending, 
  actions,
  isSelected,
  onSelectToggle
}: { 
  device: DeviceRow; 
  onEdit: (d: DeviceRow) => void; 
  onDelete: (id: string) => void; 
  onCardClick: (d: DeviceRow) => void;
  onStatusChange?: (id: string, status: "in_stock" | "transit" | "sold" | "service" | "returned" | "archived") => void;
  pending: boolean;
  actions: React.ReactNode;
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
}) {
  const totalCost = device.cost_price + (device.needs_repair ? device.repair_cost : 0);
  
  return (
    <div 
      onClick={() => onCardClick(device)}
      className={`card group relative flex flex-col justify-between p-4 transition-all duration-200 card-hover cursor-pointer ${
        pending ? "opacity-55" : ""
      } ${isSelected ? "bg-violet/[0.04] border-violet/30" : ""}`}
    >
      <div>
        {/* Ряд заголовку: Бренд і Модель */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start">
            {onSelectToggle && (
              <input
                type="checkbox"
                checked={isSelected || false}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onSelectToggle(device.id)}
                className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer mr-2 mt-0.5 bg-transparent"
              />
            )}
            <div>
              <h4 className="font-semibold text-text-primary text-sm leading-snug">
                {device.brand} {device.model}
              </h4>
              <span className="text-[9px] text-text-secondary font-semibold uppercase bg-warm-sidebar px-2 py-0.5 rounded">
                {typeLabels[device.type] || device.type}
              </span>
            </div>
          </div>

          {/* Кнопки Дій */}
          <div className="flex items-center gap-0.5 rounded-lg bg-warm-sidebar p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {device.status === 'in_stock' && onStatusChange && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(device.id, "transit"); }}
                className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-cyan/10 hover:text-cyan cursor-pointer"
                title="Повернути в дорогу"
              >
                <IconTruck size={14} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(device); }}
              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-violet/10 hover:text-violet cursor-pointer"
              title="Редагувати"
            >
              <IconEdit size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(device.id); }}
              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-rose/10 hover:text-rose cursor-pointer"
              title="Видалити"
            >
              <IconDelete size={13} />
            </button>
          </div>
        </div>

        {/* Стан та Джерело */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {device.condition_grade && (
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${conditionColors[device.condition_grade] || "bg-warm-sidebar text-text-secondary"}`}>
              {conditionLabels[device.condition_grade]}
            </span>
          )}
          {device.source && (
            <span className="rounded-md bg-warm-sidebar text-text-secondary px-1.5 py-0.5 text-[10px] font-medium">
              {sourceLabels[device.source] || device.source}
            </span>
          )}
        </div>

        {/* Характеристики (якщо є) */}
        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-text-secondary border-b border-warm-border/50 pb-2.5">
          {device.storage && (
            <div>
              Нак.: <span className="text-text-primary font-medium">{device.storage}</span>
            </div>
          )}
          {device.ram && (
            <div>
              ОЗУ: <span className="text-text-primary font-medium">{device.ram}</span>
            </div>
          )}
          {device.battery_health && (
            <div>
              АКБ: <span className="text-text-primary font-medium">{device.battery_health}%</span>
            </div>
          )}
          {device.imei && (
            <div className="col-span-2 font-mono text-[10px] truncate" title={device.imei}>
              IMEI: <span className="text-text-primary">{device.imei}</span>
            </div>
          )}
        </div>

        {/* Блок Ремонту (якщо є) */}
        {device.needs_repair && (
          <div className={`mt-3 rounded-lg border p-2.5 text-[11px] ${
            device.repair_status === "completed" || device.repair_status === "handed_over" 
            ? "bg-emerald/5 border-emerald/10 text-emerald" 
            : "bg-rose/5 border-rose/10 text-rose"
          }`}>
            <div className="font-semibold flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 flex items-center">
                  {device.repair_status === "completed" || device.repair_status === "handed_over" ? (
                    <IconCheck size={14} />
                  ) : (
                    <IconWarning size={14} />
                  )}
                </span>
                <span>
                  {device.repair_status === "completed" || device.repair_status === "handed_over" 
                    ? "Ремонт виконано" 
                    : "Потребує ремонту"}
                </span>
              </div>
              
              {device.repair_status && (
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                  device.repair_status === "pending" ? "text-amber bg-amber/10 border-amber/20" :
                  device.repair_status === "waiting_parts" ? "text-violet bg-violet/10 border-violet/20" :
                  device.repair_status === "in_progress" ? "text-rose bg-rose/10 border-rose/20" :
                  "text-cyan bg-cyan/10 border-cyan/20"
                }`}>
                  {device.repair_status === "pending" ? "Черга" :
                   device.repair_status === "waiting_parts" ? "Деталі" :
                   device.repair_status === "in_progress" ? "В процесі" :
                   "Виконано"}
                </span>
              )}
            </div>
            {device.repair_node && (
              <div className="mt-1">
                Вузол: <span className="font-medium text-text-primary">{device.repair_node}</span>
              </div>
            )}
            {device.repair_cost > 0 && (
              <div>
                Витрати на ремонт: <span className="font-bold">{device.repair_cost.toLocaleString()} грн</span>
              </div>
            )}
            {device.repair_np_ttn && (
              <div className="mt-1 flex items-center gap-1.5">
                <span>ТТН деталей:</span>
                <a
                  href={`https://novaposhta.ua/tracking/?cargo_number=${device.repair_np_ttn}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet hover:underline font-bold cursor-pointer"
                >
                  {device.repair_np_ttn} ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Замінені деталі */}
        {Array.isArray(device.repair_parts_replaced) && device.repair_parts_replaced.length > 0 && (
          <div className="mt-2.5 text-[11px] text-text-secondary border-t border-warm-border/30 pt-2">
            <span className="font-semibold block mb-1 text-text-primary text-[10px] uppercase tracking-wider">Замінені деталі:</span>
            <div className="space-y-1">
              {device.repair_parts_replaced.map((part: { name: string; cost: number; origin: string }, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-warm-sidebar/40 rounded-lg px-2.5 py-1 text-[10px] border border-warm-border/20">
                  <span className="truncate text-text-primary font-medium">
                    замінено &ldquo;{part.name}{part.origin ? ` (${part.origin})` : ""}&rdquo;
                  </span>
                  <span className="font-bold text-cyan shrink-0 ml-1">
                    {part.cost.toLocaleString()} грн
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Фінанси та Дії */}
      <div className="mt-4 pt-3 border-t border-warm-border/40 space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-secondary leading-none">Ціна продажу</span>
            <span className="text-base font-bold text-text-primary mt-1">
              {device.price.toLocaleString()} грн
            </span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-text-secondary leading-none">Собівартість</span>
            <span className="text-xs font-semibold text-text-secondary mt-1">
              {totalCost.toLocaleString()} грн
            </span>
            {device.needs_repair && device.repair_cost > 0 && (
              <span className="text-[9px] text-text-muted mt-0.5">
                ({device.cost_price} + {device.repair_cost} рем.)
              </span>
            )}
          </div>
        </div>

        {/* Кнопки дій */}
        {actions && (
          <div onClick={(e) => e.stopPropagation()} className="flex pt-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

