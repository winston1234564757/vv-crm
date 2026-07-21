"use client";

import { IconEdit, IconDelete, IconTruck } from "@/components/icons";
import { typeLabels, conditionLabels, conditionColors, sourceLabels, statusColors, statusLabels } from "./device-constants";
import type { DeviceRow } from "./table";

export function DeviceArchiveView({
  sorted,
  selectedDeviceIds,
  setSelectedDeviceIds,
  setSelectedDevice,
  setIsEditingDevice,
  handleStatusChange,
  handleDelete
}: {
  sorted: DeviceRow[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: (ids: string[]) => void;
  setSelectedDevice: (d: DeviceRow) => void;
  setIsEditingDevice: (v: boolean) => void;
  handleStatusChange: (id: string, status: any) => void;
  handleDelete: (id: string) => void;
}) {
  if (sorted.length === 0) {
    return <p className="text-xs text-text-muted text-center py-16">Архів порожній або нічого не знайдено</p>;
  }

  return (
    <>
      {/* Мобільний список карток */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {sorted.map((d) => {
          const totalCost = d.cost_price + (d.repair_cost || 0);
          const isSelected = selectedDeviceIds.includes(d.id);
          return (
            <div 
              key={d.id} 
              onClick={() => { setSelectedDevice(d); setIsEditingDevice(false); }}
              className={`rounded-2xl border border-warm-border p-4 bg-surface shadow-sm flex flex-col gap-3 transition-colors ${
                isSelected ? "border-violet bg-violet/[0.02]" : "hover:border-border-strong"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedDeviceIds([...selectedDeviceIds, d.id]);
                      } else {
                        setSelectedDeviceIds(selectedDeviceIds.filter(x => x !== d.id));
                      }
                    }}
                    className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer mt-1"
                  />
                  <div>
                    <h4 className="font-bold text-sm text-text-primary">{d.brand} {d.model}</h4>
                    <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[9px] font-semibold text-text-secondary bg-warm-sidebar px-2 py-0.5 rounded uppercase">
                        {typeLabels[d.type] || d.type}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${conditionColors[d.condition_grade ?? ""] || "bg-warm-sidebar text-text-secondary"}`}>
                        {conditionLabels[d.condition_grade ?? ""] || "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <span 
                  className="rounded-lg px-2.5 py-0.5 text-[10px] font-bold" 
                  style={{ 
                    background: `color-mix(in oklch, ${statusColors[d.status]} 18%, transparent)`, 
                    color: statusColors[d.status] 
                  }}
                >
                  {statusLabels[d.status] || d.status}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 rounded-xl bg-warm-sidebar/50 p-2.5 mt-1 border border-warm-border/30">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">Собівартість:</span>
                  <span className="font-medium">{totalCost.toLocaleString()} грн</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-secondary">Продаж:</span>
                  <span className="font-bold">{d.price.toLocaleString()} грн</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-warm-border/50 pt-1 mt-1">
                  <span className="text-text-secondary text-[10px]">Джерело:</span>
                  <span className="font-medium text-[10px]">{sourceLabels[d.source ?? ""] || d.source || "—"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-mono text-text-secondary">
                  IMEI: {d.imei || "—"}
                </span>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setSelectedDevice(d); setIsEditingDevice(true); }}
                    className="flex h-8 px-2.5 items-center justify-center rounded-xl bg-violet/5 hover:bg-violet/10 text-violet text-xs font-semibold gap-1 transition-colors cursor-pointer"
                  >
                    <IconEdit size={14} />
                    <span>Ред.</span>
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose/5 hover:bg-rose/10 text-rose transition-colors cursor-pointer"
                  >
                    <IconDelete size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Десктопна таблиця */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-border text-left text-xs font-semibold text-text-secondary">
               <th className="pb-3 pr-4 w-10">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selectedDeviceIds.length === sorted.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDeviceIds(sorted.map(x => x.id));
                    } else {
                      setSelectedDeviceIds([]);
                    }
                  }}
                  className="rounded border-iris/20 text-violet focus:ring-violet h-4 w-4 cursor-pointer bg-transparent"
                />
              </th>
              <th className="pb-3 pr-4">Модель / Категорія</th>
              <th className="pb-3 pr-4 hidden md:table-cell">Характеристики</th>
              <th className="pb-3 pr-4 hidden sm:table-cell">Стан</th>
              <th className="pb-3 pr-4 hidden md:table-cell">IMEI</th>
              <th className="pb-3 pr-4 hidden lg:table-cell">Джерело</th>
              <th className="pb-3 pr-4 text-right">Ціна продажу</th>
              <th className="pb-3 pr-4 text-right hidden sm:table-cell">Собівартість</th>
              <th className="pb-3 pr-4 text-right">Статус</th>
              <th className="pb-3 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const totalCost = d.cost_price + (d.repair_cost || 0);
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
                  <td className="py-3 pr-4 text-xs text-text-secondary space-y-0.5 hidden md:table-cell">
                    {d.storage && <div>Нак.: <span className="text-text-primary font-medium">{d.storage}</span></div>}
                    {d.ram && <div>ОЗУ: <span className="text-text-primary font-medium">{d.ram}</span></div>}
                    {d.battery_health && <div>АКБ: <span className="text-text-primary font-medium">{d.battery_health}%</span></div>}
                  </td>
                  <td className="py-3 pr-4 text-xs hidden sm:table-cell">
                    <span className={`rounded-md px-2 py-0.5 font-medium ${conditionColors[d.condition_grade ?? ""] || "bg-warm-sidebar text-text-secondary"}`}>
                      {conditionLabels[d.condition_grade ?? ""] || "—"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-text-secondary hidden md:table-cell">{d.imei || "—"}</td>
                  <td className="py-3 pr-4 text-xs text-text-secondary hidden lg:table-cell">
                    {sourceLabels[d.source ?? ""] || d.source || "—"}
                  </td>
                  <td className="py-3 pr-4 text-right font-medium">{d.price.toLocaleString()} грн</td>
                  <td className="py-3 pr-4 text-right text-text-secondary hidden sm:table-cell">
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
      </div>
    </>
  );
}
