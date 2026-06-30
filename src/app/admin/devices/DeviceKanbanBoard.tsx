"use client";

import { IconTruck, IconEdit, IconDelete, IconRepair, IconCash, IconCheck, IconWarning, IconDownload } from "@/components/icons";
import { typeLabels, conditionLabels, conditionColors, sourceLabels } from "./device-constants";
import type { DeviceRow } from "./table";

export function KanbanCard({ 
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
  const totalCost = device.cost_price + (device.repair_cost || 0);
  
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
          <div className="flex items-center gap-0.5 rounded-lg bg-warm-sidebar p-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
            {device.repair_cost > 0 && (
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

export function DeviceKanbanBoard({
  transitDevices,
  inStockDevices,
  serviceDevices,
  selectedDeviceIds,
  pendingId,
  setSelectedDevice,
  setIsEditingDevice,
  handleDelete,
  handleStatusChange,
  setSelectedDeviceIds,
  setSellingDevice,
  setReceivingDevice
}: {
  transitDevices: DeviceRow[];
  inStockDevices: DeviceRow[];
  serviceDevices: DeviceRow[];
  selectedDeviceIds: string[];
  pendingId: string | null;
  setSelectedDevice: (d: DeviceRow) => void;
  setIsEditingDevice: (v: boolean) => void;
  handleDelete: (id: string) => void;
  handleStatusChange: (id: string, status: any, repairStatus?: any) => void;
  setSelectedDeviceIds: (ids: string[]) => void;
  setSellingDevice: (d: DeviceRow) => void;
  setReceivingDevice: (d: DeviceRow) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 animate-entry">
      {/* 1. В ДОРОЗІ */}
      <div className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/10 p-3 min-h-[500px]">
        <div className="mb-3 flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 tracking-tight">
            <span className="text-violet shrink-0 flex items-center"><IconTruck size={14} /></span>
            <span>В дорозі (Transit)</span>
          </h3>
          <span className="rounded-full bg-violet/10 text-violet px-2.5 py-0.5 text-xs font-semibold">{transitDevices.length}</span>
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
                    onClick={(e) => { e.stopPropagation(); setReceivingDevice(d); }}
                    disabled={pendingId === d.id}
                    className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer"
                  >
                    <IconCheck size={14} />
                    <span>Прийняти на склад</span>
                  </button>
                }
              />
            ))
          )}
        </div>
      </div>

      {/* 2. НА СКЛАДІ */}
      <div className="flex flex-col rounded-2xl border border-warm-border bg-warm-sidebar/10 p-3 min-h-[500px]">
        <div className="mb-3 flex items-center justify-between px-2">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 tracking-tight">
            <span className="text-cyan shrink-0 flex items-center"><span className="w-2 h-2 rounded-full bg-cyan animate-pulse"/></span>
            <span>На складі (In Stock)</span>
          </h3>
          <span className="rounded-full bg-cyan/10 text-cyan px-2.5 py-0.5 text-xs font-semibold">{inStockDevices.length}</span>
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
                        className="btn-press flex-1 rounded-xl border border-amber/25 bg-amber/5 py-2 text-xs font-semibold text-amber transition-colors hover:bg-amber/10 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <IconRepair size={14} />
                        <span>В ремонт</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSellingDevice(d)}
                      disabled={pendingId === d.id}
                      className="btn-press flex-1 rounded-xl bg-violet py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
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
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5 tracking-tight">
            <span className="text-amber shrink-0 flex items-center"><IconRepair size={14} /></span>
            <span>В ремонті (Service)</span>
          </h3>
          <span className="rounded-full bg-amber/10 text-amber px-2.5 py-0.5 text-xs font-semibold">{serviceDevices.length}</span>
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
                    className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-hover disabled:opacity-50 cursor-pointer"
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
  );
}
