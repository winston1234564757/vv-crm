"use client";

import { useState } from "react";
import { Pagination, usePagination } from "@/components/ui/Pagination";
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
import { deleteDevice, updateDeviceStatus, bulkUpdateDevicesStatus, bulkUpdateDevicesTtn, receiveDeviceFromTransit } from "@/lib/actions/devices";
import Drawer from "@/components/ui/Drawer";
import { DeviceForm } from "@/components/forms/device/DeviceForm";
import { DeviceDetailView } from "@/components/DeviceDetailView";
import { SaleForm } from "@/components/forms/SaleForm";
import { InlineError } from "@/components/ui/InlineError";
import { motion } from "framer-motion";
import type { Database } from "@/types/database";
import { AddDeviceButton } from "./AddDeviceButton";

import { DeviceKanbanBoard } from "./DeviceKanbanBoard";
import { DeviceArchiveView } from "./DeviceArchiveView";

type DbDeviceRow = Database["public"]["Tables"]["devices"]["Row"];
export type DeviceRow = Omit<DbDeviceRow, "repair_parts_replaced"> & {
  repair_parts_replaced: { name: string; cost: number; origin: string }[] | null;
};


import { typeLabels, sourceLabels, conditionLabels, conditionColors, statusColors, statusLabels } from "./device-constants";



interface DevicesTableProps {
  devices: DeviceRow[];
  customers: Database["public"]["Tables"]["customers"]["Row"][];
  cashRegisters: Database["public"]["Tables"]["cash_registers"]["Row"][];
  accessories: Database["public"]["Tables"]["accessories"]["Row"][];
  services: Database["public"]["Tables"]["services"]["Row"][];
  parts: Database["public"]["Tables"]["parts"]["Row"][];

  safes?: Database["public"]["Tables"]["safes"]["Row"][];
}

export function DevicesTable({ 
  devices, 
  customers, 
  cashRegisters, 
  accessories, 
  services,
  parts,

  safes = []
}: DevicesTableProps) {
  const [activeTab, setActiveTab] = useState<"kanban" | "archive">("kanban");
  
  // Фільтри та пошук
  const [query, setQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");

  // Професійні фільтри для архіву
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<"all" | "sold" | "returned" | "archived">("all");
  const [marginFilter, setMarginFilter] = useState<"all" | "high" | "low" | "deficit">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week" | "month" | "prev_month">("all");
  
  // Сортування
  const [sortBy, setSortBy] = useState<
    "updated_at_desc" | "updated_at_asc" | 
    "created_at_desc" | "created_at_asc" | 
    "price_desc" | "price_asc" | 
    "cost_desc" | "cost_asc" | 
    "profit_desc" | "profit_asc"
  >("created_at_desc");
  
  // Модальні вікна / Drawer
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [isEditingDevice, setIsEditingDevice] = useState(false);
  const [sellingDevice, setSellingDevice] = useState<DeviceRow | null>(null);
  
  // States for receiving device from transit
  const [receivingDevice, setReceivingDevice] = useState<DeviceRow | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const [selectedSafeId, setSelectedSafeId] = useState<string>("");

  // Помилки та успіх
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  
  // Bulk Selection
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [bulkTtn, setBulkTtn] = useState("");

  async function handleReceiveDevice() {
    if (!receivingDevice) return;
    setIsReceiving(true);
    const res = await receiveDeviceFromTransit(receivingDevice.id, selectedSafeId || null);
    setIsReceiving(false);
    if (res.success) {
      setReceivingDevice(null);
    } else {
      setError(res.error ?? "Помилка прийомки пристрою");
      setReceivingDevice(null);
    }
  }

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

    // 4. Специфічні фільтри для архіву
    if (activeTab === "archive") {
      if (archiveStatusFilter !== "all" && d.status !== archiveStatusFilter) return false;

      const totalCost = d.cost_price + (d.repair_cost || 0);
      const profit = d.price - totalCost;
      const ros = d.price > 0 ? (profit / d.price) * 100 : 0;

      if (marginFilter === "high" && !(profit >= 5000 || ros >= 25)) return false;
      if (marginFilter === "low" && !(profit >= 0 && profit <= 2000)) return false;
      if (marginFilter === "deficit" && profit < 0) return false;

      if (dateFilter !== "all" && d.updated_at) {
        const uDate = new Date(d.updated_at);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        if (dateFilter === "today" && uDate < startOfToday) return false;
        if (dateFilter === "yesterday" && (uDate < startOfYesterday || uDate >= startOfToday)) return false;
        if (dateFilter === "week" && uDate < startOfWeek) return false;
        if (dateFilter === "month" && uDate < startOfMonth) return false;
        if (dateFilter === "prev_month" && (uDate < startOfPrevMonth || uDate > endOfPrevMonth)) return false;
      }
    }

    return true;
  });

  // Сортування
  const sorted = [...filtered].sort((a, b) => {
    const costA = a.cost_price + (a.repair_cost || 0);
    const costB = b.cost_price + (b.repair_cost || 0);
    const profitA = a.price - costA;
    const profitB = b.price - costB;

    switch (sortBy) {
      case "updated_at_desc":
        return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      case "updated_at_asc":
        return new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
      case "created_at_desc":
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      case "created_at_asc":
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      case "price_desc":
        return b.price - a.price;
      case "price_asc":
        return a.price - b.price;
      case "cost_desc":
        return costB - costA;
      case "cost_asc":
        return costA - costB;
      case "profit_desc":
        return profitB - profitA;
      case "profit_asc":
        return profitA - profitB;
      default:
        return 0;
    }
  });

  // Групування для Канбану (канбан не пагінується — він згрупований за статусами)
  const transitDevices = sorted.filter((d) => d.status === "transit");
  const inStockDevices = sorted.filter((d) => d.status === "in_stock");
  const serviceDevices = sorted.filter((d) => d.status === "service");

  // Архів росте без меж — пагінуємо саме його
  const archivePager = usePagination(sorted, {
    resetKey: `${activeTab}|${query}|${filterType}|${filterBrand}|${filterCondition}|${archiveStatusFilter}|${marginFilter}|${dateFilter}|${sortBy}`,
  });

  const hasActiveFilters = 
    filterType !== "all" || 
    filterBrand !== "all" || 
    filterCondition !== "all" ||
    archiveStatusFilter !== "all" ||
    marginFilter !== "all" ||
    dateFilter !== "all";

  const handleResetFilters = () => {
    setFilterType("all");
    setFilterBrand("all");
    setFilterCondition("all");
    setArchiveStatusFilter("all");
    setMarginFilter("all");
    setDateFilter("all");
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
              className="rounded-xl border border-warm-border bg-surface px-3.5 py-2 text-xs text-text-primary placeholder-iris/50 outline-none transition-colors focus:border-violet/40 min-w-[150px]"
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
              className="rounded-xl border border-warm-border bg-surface hover:bg-warm-hover text-text-secondary px-3.5 py-2 text-xs font-semibold cursor-pointer transition-colors"
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
              setSortBy("created_at_desc");
              handleResetFilters();
              setSelectedDeviceIds([]);
            }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "kanban"
                ? "bg-surface text-text-primary shadow-sm"
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
              setSortBy("updated_at_desc");
              handleResetFilters();
              setSelectedDeviceIds([]);
            }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "archive"
                ? "bg-surface text-text-primary shadow-sm"
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

          {/* Вибір сортування */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none rounded-xl border border-warm-border bg-warm-surface pl-3 pr-8 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-violet/20 outline-none transition-colors focus:border-violet/40 cursor-pointer min-w-[170px]"
            >
              {activeTab === "archive" ? (
                <>
                  <option value="updated_at_desc">🕒 Спочатку продані</option>
                  <option value="updated_at_asc">🕒 Давні продажі</option>
                  <option value="created_at_desc">🆕 Нові надходження</option>
                  <option value="created_at_asc">⏳ Старі надходження</option>
                  <option value="price_desc">💰 Ціна: від високої</option>
                  <option value="price_asc">💰 Ціна: від низької</option>
                  <option value="profit_desc">📈 Прибуток: від високого</option>
                  <option value="profit_asc">📉 Прибуток: від низького</option>
                  <option value="cost_desc">🏷️ Собівартість: від високої</option>
                  <option value="cost_asc">🏷️ Собівартість: від низької</option>
                </>
              ) : (
                <>
                  <option value="created_at_desc">🆕 Спочатку нові</option>
                  <option value="created_at_asc">⏳ Спочатку старі</option>
                  <option value="price_desc">💰 Ціна: від високої</option>
                  <option value="price_asc">💰 Ціна: від низької</option>
                </>
              )}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
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
        <div className="mt-4 rounded-xl border border-warm-border bg-warm-sidebar/30 p-4 animate-entry space-y-4">
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

          {/* Другий ряд розширених фільтрів, тільки для вкладки Архів */}
          {activeTab === "archive" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-warm-border/50 pt-4 animate-entry">
              {/* Статус Архіву */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Статус архіву</label>
                <select
                  value={archiveStatusFilter}
                  onChange={(e) => setArchiveStatusFilter(e.target.value as any)}
                  className="w-full rounded-lg border border-warm-border bg-warm-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
                >
                  <option value="all">Усі в архіві</option>
                  <option value="sold">Продано</option>
                  <option value="returned">Повернення</option>
                  <option value="archived">Архів</option>
                </select>
              </div>

              {/* Маржинальність */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Маржинальність / Прибуток</label>
                <select
                  value={marginFilter}
                  onChange={(e) => setMarginFilter(e.target.value as any)}
                  className="w-full rounded-lg border border-warm-border bg-warm-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
                >
                  <option value="all">Усі рівні прибутку</option>
                  <option value="high">📈 Високомаржинальні (≥5,000₴ або ≥25%)</option>
                  <option value="low">📉 Низькомаржинальні (0 - 2,000₴)</option>
                  <option value="deficit">⚠️ Збиткові (&lt;0₴)</option>
                </select>
              </div>

              {/* Період продажу */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Період продажу / оновлення</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full rounded-lg border border-warm-border bg-warm-surface px-3 py-2 text-xs text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
                >
                  <option value="all">За весь час</option>
                  <option value="today">Сьогодні</option>
                  <option value="yesterday">Вчора</option>
                  <option value="week">Останні 7 днів</option>
                  <option value="month">Цей місяць</option>
                  <option value="prev_month">Минулий місяць</option>
                </select>
              </div>
            </div>
          )}

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
          <DeviceKanbanBoard
            transitDevices={transitDevices}
            inStockDevices={inStockDevices}
            serviceDevices={serviceDevices}
            selectedDeviceIds={selectedDeviceIds}
            pendingId={pendingId}
            setSelectedDevice={setSelectedDevice}
            setIsEditingDevice={setIsEditingDevice}
            handleDelete={handleDelete}
            handleStatusChange={handleStatusChange}
            setSelectedDeviceIds={setSelectedDeviceIds}
            setSellingDevice={setSellingDevice}
            setReceivingDevice={(d) => {
              setReceivingDevice(d);
              const opexSafe = safes.find(s => s.type === "opex" || s.name.toLowerCase().includes("opex"));
              setSelectedSafeId(opexSafe ? opexSafe.id : (safes[0]?.id || ""));
            }}
          />
        ) : (
          <>
            <DeviceArchiveView
              sorted={archivePager.pageItems}
              selectedDeviceIds={selectedDeviceIds}
              setSelectedDeviceIds={setSelectedDeviceIds}
              setSelectedDevice={setSelectedDevice}
              setIsEditingDevice={setIsEditingDevice}
              handleStatusChange={handleStatusChange}
              handleDelete={handleDelete}
            />
            <Pagination
              page={archivePager.page}
              pageCount={archivePager.pageCount}
              total={archivePager.total}
              start={archivePager.start}
              shown={archivePager.pageItems.length}
              pageSize={archivePager.pageSize}
              onPageChange={archivePager.setPage}
              onPageSizeChange={archivePager.setPageSize}
              itemLabel="пристроїв"
            />
          </>
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
              safes={safes}
            />
          ) : (
            <DeviceDetailView 
              device={selectedDevice} 
              onEdit={() => setIsEditingDevice(true)} 
              onSell={() => { setSellingDevice(selectedDevice); setSelectedDevice(null); }}
              onClose={() => setSelectedDevice(null)} 
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

      {/* MOBILE FLOATING CTA */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <AddDeviceButton 
          parts={parts} 
          safes={safes} 
          size="half"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan text-white shadow-xl hover:bg-cyan-hover transition-all active:scale-95 border border-cyan/10"
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-white">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </AddDeviceButton>
      </div>

      {/* MODAL: ПРИЙНЯТТЯ ПРИСТРОЮ З ТРАНЗИТУ */}
      {receivingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 animate-entry">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-text-primary mb-1 tracking-tight">✅ Прийняти пристрій на склад</h3>
            <p className="text-sm text-text-secondary mb-4 leading-snug">
              {receivingDevice.brand} {receivingDevice.model}
            </p>
 
            <div className="space-y-3">
              {safes.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Сейф для списання коштів</label>
                  <select
                    value={selectedSafeId}
                    onChange={(e) => setSelectedSafeId(e.target.value)}
                    className="w-full rounded-xl border border-warm-border bg-surface px-4 py-2.5 text-sm text-text-primary outline-none focus:border-violet/40 cursor-pointer"
                  >
                    <option value="">Не списувати (без оплати / вже оплачено)</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.balance.toLocaleString()} ₴)
                      </option>
                    ))}
                  </select>
                </div>
              )}
 
              <div className="rounded-xl bg-emerald/5 border border-emerald/20 p-3 text-xs text-text-secondary">
                <p className="font-medium text-text-primary mb-0.5">Сума списання</p>
                <p className="text-sm font-bold text-emerald">{receivingDevice.cost_price.toLocaleString()} грн</p>
                <p className="mt-1 text-[10px] text-text-secondary">
                  {selectedSafeId 
                    ? "Гроші будуть списані з обраного сейфу автоматично, буде створено фінансову транзакцію." 
                    : "Списання коштів вимкнено. Статус пристрою зміниться на 'В наявності', але сейфи залишаться без змін."}
                </p>
              </div>
 
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setReceivingDevice(null)}
                  className="flex-1 rounded-xl border border-warm-border py-2.5 text-sm text-text-secondary hover:bg-warm-surface transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleReceiveDevice}
                  disabled={isReceiving}
                  className="flex-1 rounded-xl bg-emerald py-2.5 text-sm font-semibold text-white hover:bg-emerald/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isReceiving ? "Приймаю..." : "Прийняти на склад"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


