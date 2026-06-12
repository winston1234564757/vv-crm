"use client";

import { Input } from "@/components/ui/Input";
import { ReplacedPart, WarehousePart, DeviceFormData, RepairPartsData } from "@/lib/types/device.types";

interface DeviceFormRepairProps {
  device: DeviceFormData;
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
  parts: WarehousePart[];
}

export function DeviceFormRepair({
  device,
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
  parts,
}: DeviceFormRepairProps) {


  return (
    <div className="border-t border-warm-border/50 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <input 
          id="needs_repair_toggle" 
          type="checkbox" 
          name="needs_repair"
          value="true"
          checked={needsRepair}
          onChange={(e) => setNeedsRepair(e.target.checked)}
          className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer" 
        />
        <label htmlFor="needs_repair_toggle" className="text-sm font-medium text-text-primary cursor-pointer">
          Пристрій потребує ремонту / передпродажної підготовки на складі
        </label>
      </div>

      {needsRepair && (
        <div className="space-y-4 rounded-xl bg-amber/5 border border-amber/10 p-4 animate-entry">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input 
              label="Вузол під ремонт (що зламано?)" 
              name="repair_node" 
              placeholder="Дисплейний модуль, гніздо зарядки..." 
              defaultValue={device?.repair_node ?? ""} 
            />
            
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">Статус ремонту</label>
              <select
                value={repairStatus}
                onChange={(e) => setRepairStatus(e.target.value)}
                className="w-full rounded-xl border border-warm-border/60 bg-warm-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet/40 cursor-pointer"
              >
                <option value="pending">Очікує ремонту / В черзі</option>
                <option value="waiting_parts">Очікує деталей</option>
                <option value="in_progress">В процесі ремонту</option>
                <option value="completed">Ремонт завершено</option>
              </select>
              <input type="hidden" name="repair_status" value={repairStatus} />
            </div>

            <Input 
              label="ТТН посилки із деталями" 
              name="repair_np_ttn" 
              placeholder="204500XXXXXXXX" 
              defaultValue={device?.repair_np_ttn ?? ""} 
            />
          </div>

          {/* Replaced parts */}
          <div className="border-t border-warm-border/30 pt-3">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Замінені деталі</h4>
            <input type="hidden" name="repair_parts_replaced" value={JSON.stringify(partsReplaced)} />
            
            {partsReplaced.length === 0 ? (
              <p className="text-xs text-text-muted italic py-1">Деталей ще не додано</p>
            ) : (
              <div className="space-y-2 mb-3">
                {partsReplaced.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-warm-sidebar/50 px-3 py-2 text-xs border border-warm-border/40">
                    <div>
                      <span className="font-semibold text-text-primary">{p.name}</span>
                      {p.origin && (
                        <span className="ml-1.5 rounded bg-violet/5 px-1.5 py-0.5 text-[10px] font-bold text-violet">{p.origin}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-cyan">{p.cost.toLocaleString()} грн</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(idx)}
                        className="text-rose hover:text-rose-hover font-semibold cursor-pointer"
                      >
                        Видалити
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new part form */}
            <div className="mt-3 rounded-lg border border-warm-border/50 bg-warm-surface p-3 space-y-3">
              <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">+ Додати замінену деталь</p>
              
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-text-secondary">Вибрати запчастину зі складу (опціонально)</label>
                  <select
                    value={selectedPartId}
                    onChange={(e) => handleSelectWarehousePart(e.target.value)}
                    className="w-full rounded-lg border border-warm-border/60 bg-warm-sidebar px-3 py-2 text-xs text-text-primary outline-none cursor-pointer"
                  >
                    <option value="">-- Ввести вручну --</option>
                    {parts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.origin_type ? `(${p.origin_type})` : ""} — {p.cost_price} грн (залишок: {p.stock} шт)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-text-secondary">Назва деталі *</label>
                    <input 
                      type="text" 
                      value={newPartName} 
                      onChange={(e) => setNewPartName(e.target.value)}
                      placeholder="Наприклад: Дисплей"
                      className="w-full rounded-lg border border-warm-border/60 bg-warm-sidebar px-3 py-2 text-xs text-text-primary outline-none focus:border-violet-40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-text-secondary">Походження</label>
                    <select
                      value={newPartOrigin}
                      onChange={(e) => setNewPartOrigin(e.target.value)}
                      className="w-full rounded-lg border border-warm-border/60 bg-warm-sidebar px-3 py-2 text-xs text-text-primary outline-none cursor-pointer"
                    >
                      <option value="Copy">Copy</option>
                      <option value="HC">HC</option>
                      <option value="Brand Copy">Brand Copy</option>
                      <option value="OEM">OEM</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-text-secondary">Сума (собівартість) *</label>
                    <input 
                      type="number" 
                      value={newPartCost || ""} 
                      onChange={(e) => setNewPartCost(Number(e.target.value))}
                      placeholder="1200"
                      className="w-full rounded-lg border border-warm-border/60 bg-warm-sidebar px-3 py-2 text-xs text-text-primary outline-none focus:border-violet-40"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAddPart}
                  disabled={!newPartName.trim()}
                  className="rounded-lg bg-violet/10 px-3.5 py-1.5 text-xs font-semibold text-violet hover:bg-violet/20 disabled:opacity-50 cursor-pointer"
                >
                  Додати до списку
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-warm-border/30 pt-3">
            <Input 
              label="Загальна вартість ремонту (грн) — деталі + додаткові витрати" 
              name="repair_cost" 
              type="number" 
              placeholder="1500" 
              value={repairCost}
              onChange={(e) => setRepairCost(Number(e.target.value))}
            />
            <p className="mt-1 text-[10px] text-text-secondary">
              * Вартість автоматично збільшується при додаванні деталей з списку вище, але ви можете відредагувати її вручну.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeviceFormRepair;