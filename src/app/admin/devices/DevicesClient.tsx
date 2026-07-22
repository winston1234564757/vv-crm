"use client";

import { useMemo, useState, useTransition } from "react";
import type { Database } from "@/types/database";

import { ListPageShell } from "@/components/list/ListPageShell";
import { useListQuery } from "@/components/list/useListQuery";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Toolbar, SearchField } from "@/components/ui/Toolbar";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import { InlineError } from "@/components/ui/InlineError";
import { IconDevice, IconTruck, IconEdit, IconDelete, IconCash, IconRepair } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

import { DeviceForm } from "@/components/forms/device/DeviceForm";
import { DeviceDetailView } from "@/components/DeviceDetailView";
import { SaleForm } from "@/components/forms/SaleForm";
import { AddDeviceButton } from "./AddDeviceButton";

import {
  deleteDevice,
  updateDeviceStatus,
  bulkUpdateDevicesStatus,
  bulkUpdateDevicesTtn,
  receiveDeviceFromTransit,
} from "@/lib/actions/devices";
import { createWarehouseRepair } from "@/lib/actions/repairs";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";

import { optionsOf, deviceType, deviceCondition } from "@/lib/domain-labels";
import { STAGE_ORDER, stageLabels, type DeviceStage } from "@/lib/device-stage";
import type { DeviceRepairMap } from "@/lib/data-devices";
import { activeColumns, archiveColumns, deviceCard, stageOf } from "./device-columns";
import { type DeviceRow, type DeviceWithRepairs, profitOf } from "./device-types";

type Segment = "all" | DeviceStage | "attention";

const iconBtn =
  "btn-press flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-hover hover:text-ink";

interface DevicesClientProps {
  devices: DeviceRow[];
  deviceRepairs: DeviceRepairMap;
  customers: Database["public"]["Tables"]["customers"]["Row"][];
  cashRegisters: Database["public"]["Tables"]["cash_registers"]["Row"][];
  accessories: Database["public"]["Tables"]["accessories"]["Row"][];
  services: Database["public"]["Tables"]["services"]["Row"][];
  parts: Database["public"]["Tables"]["parts"]["Row"][];
  safes?: Database["public"]["Tables"]["safes"]["Row"][];
}

export function DevicesClient({
  devices,
  deviceRepairs,
  customers,
  cashRegisters,
  accessories,
  services,
  parts,
  safes = [],
}: DevicesClientProps) {
  const query = useListQuery({
    mode: "client",
    filters: {
      stage: "all",
      type: "all",
      brand: "all",
      cond: "all",
      margin: "all",
      period: "all",
    },
  });

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTtn, setBulkTtn] = useState("");

  const [selectedDevice, setSelectedDevice] = useState<DeviceWithRepairs | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sellingDevice, setSellingDevice] = useState<DeviceWithRepairs | null>(null);
  const [receivingDevice, setReceivingDevice] = useState<DeviceWithRepairs | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<DeviceWithRepairs | null>(null);
  const [selectedSafeId, setSelectedSafeId] = useState("");

  // Starting a repair on our own device. This replaces the intake form's
  // "Внутрішній (Склад)" toggle, which created rows that /admin/repairs then
  // filtered out — every orphaned repair row came from there.
  const [repairing, setRepairing] = useState<DeviceWithRepairs | null>(null);
  const [repairIssue, setRepairIssue] = useState("");
  const [repairCost, setRepairCost] = useState("0");

  // Attach repair rows once; every stage decision downstream reads from here.
  const rows: DeviceWithRepairs[] = useMemo(
    () => devices.map((d) => ({ ...d, repairs: deviceRepairs[d.id] ?? [] })),
    [devices, deviceRepairs],
  );

  const brands = useMemo(
    () =>
      Array.from(new Set(devices.map((d) => d.brand).filter(Boolean)))
        .sort()
        .map((b) => ({ value: b as string, label: b as string })),
    [devices],
  );

  const segment = (query.filters.stage ?? "all") as Segment;
  const isArchiveView = segment === "archived";

  /**
   * Everything except the stage segment. The segment counts are computed from
   * this, so searching for a sold device while standing on "В наявності" shows
   * "Архів (1)" rather than an empty screen that reads as "it does not exist".
   */
  const base = useMemo(() => {
    const q = query.search.trim().toLowerCase();
    return rows.filter((d) => {
      if (q) {
        const haystack = [d.brand, d.model, d.imei, d.sku, d.serial_number]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (query.filters.type !== "all" && d.type !== query.filters.type) return false;
      if (query.filters.brand !== "all" && d.brand !== query.filters.brand) return false;
      if (query.filters.cond !== "all" && d.condition_grade !== query.filters.cond) return false;

      if (query.filters.margin !== "all") {
        const p = profitOf(d);
        const ros = d.price > 0 ? (p / d.price) * 100 : 0;
        if (query.filters.margin === "high" && !(p >= 5000 || ros >= 25)) return false;
        if (query.filters.margin === "low" && !(p >= 0 && p < 2000)) return false;
        if (query.filters.margin === "deficit" && p >= 0) return false;
      }

      if (query.filters.period !== "all") {
        const updated = new Date(d.updated_at).getTime();
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const day = 24 * 60 * 60 * 1000;
        if (query.filters.period === "today" && updated < startOfToday) return false;
        if (query.filters.period === "week" && updated < startOfToday - 7 * day) return false;
        if (
          query.filters.period === "month" &&
          updated < new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        )
          return false;
      }
      return true;
    });
  }, [rows, query.search, query.filters]);

  const counts = useMemo(() => {
    const c: Record<Segment, number> = {
      all: base.length,
      transit: 0,
      needs_repair: 0,
      in_repair: 0,
      in_stock: 0,
      archived: 0,
      attention: 0,
    };
    for (const d of base) {
      const { stage, discrepancies } = stageOf(d);
      c[stage] += 1;
      if (discrepancies.length > 0) c.attention += 1;
    }
    return c;
  }, [base]);

  const visible = useMemo(() => {
    if (segment === "all") return base;
    if (segment === "attention") return base.filter((d) => stageOf(d).discrepancies.length > 0);
    return base.filter((d) => stageOf(d).stage === segment);
  }, [base, segment]);

  const tabs: TabItem<Segment>[] = [
    { value: "all", label: "Усі", count: counts.all },
    ...STAGE_ORDER.map((s) => ({ value: s as Segment, label: stageLabels[s], count: counts[s] })),
    // Only worth a tab when there is something wrong to look at.
    ...(counts.attention > 0
      ? [{ value: "attention" as Segment, label: "Потребує уваги", count: counts.attention }]
      : []),
  ];

  function run(fn: () => Promise<{ success: boolean; error?: string | null }>, onOk?: () => void) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (res.success) onOk?.();
      else setError(res.error || "Не вдалося виконати дію");
    });
  }

  const columns = isArchiveView ? archiveColumns() : activeColumns();

  /**
   * Row actions, per stage. Two rules from the design review are enforced here:
   *
   * 1. `sold` is unreachable from a row — a sale goes through SaleForm so that
   *    money and stock move together.
   * 2. The archive is closed. The previous archive view offered "Повернути в
   *    дорогу" on any device with `status !== 'transit'`, which included sold
   *    ones: one click put a sold device back into circulation while its sale
   *    row stayed untouched. Reversing a sale is an operation on the sale.
   */
  const actionColumn = {
    key: "actions",
    header: "",
    align: "right" as const,
    interactive: true,
    cell: (d: DeviceWithRepairs) => {
      const { stage } = stageOf(d);
      const archived = stage === "archived";
      return (
        <div className="flex items-center justify-end gap-1">
          {stage === "transit" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReceivingDevice(d);
                setSelectedSafeId("");
              }}
            >
              Прийняти
            </Button>
          )}
          {!archived && stage !== "transit" && (
            <Button size="sm" variant="secondary" leadingIcon={<IconCash size={13} />} onClick={() => setSellingDevice(d)}>
              Продати
            </Button>
          )}
          {/* Only the move that matters at this stage gets words. The rest are
              icons, or the row would spend 350px on buttons. */}
          {!archived && stage !== "transit" && stage !== "in_repair" && (
            <button
              type="button"
              title="Відправити в ремонт"
              onClick={() => {
                setRepairing(d);
                setRepairIssue("");
                setRepairCost(String(d.repair_cost || 0));
              }}
              className={iconBtn}
            >
              <IconRepair size={15} />
            </button>
          )}
          {!archived && stage !== "transit" && (
            <button
              type="button"
              title="Повернути в дорогу"
              onClick={() => run(() => updateDeviceStatus(d.id, "transit"))}
              className={iconBtn}
            >
              <IconTruck size={15} />
            </button>
          )}
          <button
            type="button"
            title="Редагувати"
            onClick={() => {
              setSelectedDevice(d);
              setIsEditing(true);
            }}
            className={iconBtn}
          >
            <IconEdit size={15} />
          </button>
          <button
            type="button"
            title="Видалити"
            onClick={() => setDeletingDevice(d)}
            className={cn(iconBtn, "hover:bg-danger-subtle hover:text-danger")}
          >
            <IconDelete size={15} />
          </button>
        </div>
      );
    },
  };

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />

      <Tabs
        tabs={tabs}
        value={segment}
        onValueChange={(v) => query.setFilter("stage", v)}
        aria-label="Етап конвеєра"
        className="mb-4"
      />

      <ListPageShell
        query={query}
        rows={visible}
        getRowId={(d) => d.id}
        columns={[...columns, actionColumn]}
        card={deviceCard}
        onRowClick={(d) => {
          setSelectedDevice(d);
          setIsEditing(false);
        }}
        itemLabel="пристроїв"
        selection={{
          selectedIds,
          onChange: setSelectedIds,
          selectableIds: visible.map((d) => d.id),
          bulkBar: (
            <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-accent-subtle bg-accent-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-ink">
                Обрано {selectedIds.length} — групові дії
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() =>
                    run(() => bulkUpdateDevicesStatus(selectedIds, "in_stock"), () => setSelectedIds([]))
                  }
                >
                  В наявності
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() =>
                    run(() => bulkUpdateDevicesStatus(selectedIds, "service"), () => setSelectedIds([]))
                  }
                >
                  В сервіс
                </Button>
                <input
                  type="text"
                  value={bulkTtn}
                  onChange={(e) => setBulkTtn(e.target.value)}
                  placeholder="ТТН закупівлі"
                  className="h-8 min-w-[150px] rounded-[var(--radius-md)] border border-border bg-surface px-3 text-xs text-ink outline-none transition-colors placeholder-faint focus:border-accent"
                />
                <Button
                  size="sm"
                  disabled={isPending || !bulkTtn}
                  onClick={() =>
                    run(() => bulkUpdateDevicesTtn(selectedIds, bulkTtn), () => {
                      setSelectedIds([]);
                      setBulkTtn("");
                    })
                  }
                >
                  Задати ТТН
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                  Скасувати
                </Button>
              </div>
            </div>
          ),
        }}
        toolbar={
          <Toolbar
            search={
              <SearchField
                value={query.draftSearch}
                onChange={(e) => query.setDraftSearch(e.target.value)}
                onClear={query.clearSearch}
                placeholder="Бренд, модель, IMEI, SKU..."
              />
            }
          >
            <Select
              value={query.filters.type}
              onChange={(e) => query.setFilter("type", e.target.value)}
              inline
              aria-label="Категорія"
            >
              <option value="all">Усі категорії</option>
              {optionsOf(deviceType).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select
              value={query.filters.brand}
              onChange={(e) => query.setFilter("brand", e.target.value)}
              inline
              aria-label="Бренд"
            >
              <option value="all">Усі бренди</option>
              {brands.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>

            <Select
              value={query.filters.cond}
              onChange={(e) => query.setFilter("cond", e.target.value)}
              inline
              aria-label="Стан"
            >
              <option value="all">Будь-який стан</option>
              {optionsOf(deviceCondition).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            {/* Margin and period only earn their space where the money is final. */}
            {isArchiveView && (
              <>
                <Select
                  value={query.filters.margin}
                  onChange={(e) => query.setFilter("margin", e.target.value)}
                  inline
                  aria-label="Прибутковість"
                >
                  <option value="all">Будь-який прибуток</option>
                  <option value="high">Високомаржинальні</option>
                  <option value="low">Низькомаржинальні</option>
                  <option value="deficit">Збиткові</option>
                </Select>
                <Select
                  value={query.filters.period}
                  onChange={(e) => query.setFilter("period", e.target.value)}
                  inline
                  aria-label="Період"
                >
                  <option value="all">За весь час</option>
                  <option value="today">Сьогодні</option>
                  <option value="week">7 днів</option>
                  <option value="month">Цей місяць</option>
                </Select>
              </>
            )}
          </Toolbar>
        }
        empty={{
          title:
            segment === "attention"
              ? "Розбіжностей немає"
              : segment === "all"
                ? "Техніки ще немає"
                : `На етапі «${stageLabels[segment as DeviceStage] ?? ""}» порожньо`,
          description:
            segment === "attention"
              ? "Дані про ремонти узгоджені з картками пристроїв."
              : "Додайте перший пристрій — він одразу стане на конвеєр.",
          icon: <IconDevice size={20} />,
          action: segment === "all" ? <AddDeviceButton parts={parts} safes={safes} size="half" /> : undefined,
        }}
        noResults={{
          title: "Нічого не знайдено",
          description: "Подивіться на лічильники етапів — можливо, пристрій на іншому.",
        }}
      />

      {/* Перегляд і редагування */}
      <Drawer
        isOpen={!!selectedDevice}
        onClose={() => {
          setSelectedDevice(null);
          setIsEditing(false);
        }}
        title={isEditing ? "Редагувати пристрій" : "Деталі пристрою"}
        size="half"
      >
        {selectedDevice &&
          (isEditing ? (
            <DeviceForm
              onSuccess={() => {
                setSelectedDevice(null);
                setIsEditing(false);
              }}
              device={selectedDevice}
              parts={parts}
              safes={safes}
            />
          ) : (
            <DeviceDetailView
              device={selectedDevice}
              onEdit={() => setIsEditing(true)}
              onSell={() => {
                setSellingDevice(selectedDevice);
                setSelectedDevice(null);
              }}
              onClose={() => setSelectedDevice(null)}
            />
          ))}
      </Drawer>

      {/* Продаж — єдиний шлях до статусу «продано» */}
      <Drawer
        isOpen={!!sellingDevice}
        onClose={() => setSellingDevice(null)}
        title="Швидкий продаж техніки"
        size="default"
      >
        {sellingDevice && (
          <SaleForm
            customers={customers}
            cashRegisters={cashRegisters}
            devices={devices}
            accessories={accessories}
            services={services}
            initialCategory="device"
            initialItemId={sellingDevice.id}
            onSuccess={() => setSellingDevice(null)}
          />
        )}
      </Drawer>

      {/* Прийом із дороги — рухає гроші з сейфа */}
      <Modal
        isOpen={!!receivingDevice}
        onClose={() => setReceivingDevice(null)}
        title="Прийняти пристрій на склад"
        description={
          receivingDevice ? `${receivingDevice.brand} ${receivingDevice.model}` : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReceivingDevice(null)}>
              Скасувати
            </Button>
            <Button
              isLoading={isPending}
              onClick={() =>
                receivingDevice &&
                run(
                  () => receiveDeviceFromTransit(receivingDevice.id, selectedSafeId || null),
                  () => setReceivingDevice(null),
                )
              }
            >
              Прийняти
            </Button>
          </>
        }
      >
        {safes.length > 0 && (
          <Select
            label="Сейф для списання коштів"
            value={selectedSafeId}
            onChange={(e) => setSelectedSafeId(e.target.value)}
            hint="Собівартість буде списана з обраного сейфа."
          >
            <option value="">Не списувати</option>
            {safes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </Modal>

      {/* Складський ремонт — два поля, бо клієнта, гарантії й квитанції тут немає */}
      <Modal
        isOpen={!!repairing}
        onClose={() => setRepairing(null)}
        title="Відправити в ремонт"
        description={repairing ? `${repairing.brand} ${repairing.model}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRepairing(null)}>
              Скасувати
            </Button>
            <Button
              isLoading={isPending}
              disabled={repairIssue.trim().length < 5}
              onClick={() =>
                repairing &&
                run(
                  () =>
                    createWarehouseRepair(repairing.id, repairIssue, Number(repairCost) || 0),
                  () => setRepairing(null),
                )
              }
            >
              Створити ремонт
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label="Що ремонтуємо"
            value={repairIssue}
            onChange={(e) => setRepairIssue(e.target.value)}
            rows={3}
            placeholder="Напр. заміна акумулятора, не тримає заряд"
            hint="Від 5 символів."
          />
          <Input
            label="Кошторис, ₴"
            type="number"
            inputMode="numeric"
            min={0}
            value={repairCost}
            onChange={(e) => setRepairCost(e.target.value)}
            hint="Собівартість робіт і деталей. Уточните пізніше."
          />
        </div>
      </Modal>

      {/* Видалення — раніше це був native confirm() */}
      <Modal
        isOpen={!!deletingDevice}
        onClose={() => setDeletingDevice(null)}
        title="Видалити пристрій?"
        description={
          deletingDevice
            ? `${deletingDevice.brand} ${deletingDevice.model} буде видалено назавжди.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingDevice(null)}>
              Скасувати
            </Button>
            <Button
              variant="danger"
              isLoading={isPending}
              onClick={() =>
                deletingDevice &&
                run(() => deleteDevice(deletingDevice.id), () => setDeletingDevice(null))
              }
            >
              Видалити
            </Button>
          </>
        }
      >
        {deletingDevice && stageOf(deletingDevice).discrepancies.length > 0 && (
          <Badge tone="warning">
            По цьому пристрою є незакритий ремонт — видалення його не закриє.
          </Badge>
        )}
      </Modal>
    </>
  );
}
