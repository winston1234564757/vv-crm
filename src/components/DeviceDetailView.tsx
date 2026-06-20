"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  IconEdit, IconDevice, IconFinance, IconBox, IconRepair
} from "./icons";
import Drawer from "@/components/ui/Drawer";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import type { getInternalRepairs } from "@/lib/data-repairs";

type RepairRow = Awaited<ReturnType<typeof getInternalRepairs>>[number];

type DeviceDetailViewProps = {
  device: {
    id: string;
    brand: string | null;
    model: string | null;
    type: string;
    condition_grade: string | null;
    condition_description: string | null;
    storage: string | null;
    ram: string | null;
    battery_health: number | null;
    color: string | null;
    cpu: string | null;
    gpu: string | null;
    screen_size: string | null;
    serial_number: string | null;
    imei: string | null;
    cost_price: number;
    repair_cost: number;
    price: number;
    status: string;
    needs_repair: boolean;
    repair_status: string;
    repair_node: string | null;
    repair_np_ttn: string | null;
    repair_parts_replaced: Array<{ name: string; cost: number; origin: string }> | string | null;
    notes: string | null;
    description: string | null;
    photo_urls: string[] | null;
    original_box: boolean | null;
    accessories_included: string | null;
    source: string | null;
    source_reference: string | null;
  };
  repairs?: RepairRow[];
  onEdit: () => void;
  onSell?: () => void;
  onClose: () => void;
};

const statusColors: Record<string, string> = {
  in_stock: "var(--color-cyan)",
  transit: "var(--color-amber)",
  sold: "var(--color-iris)",
  service: "var(--color-rose)",
  returned: "var(--color-violet)",
  archived: "var(--color-text-muted)"
};

const statusLabels: Record<string, string> = {
  in_stock: "В наявності",
  transit: "В дорозі",
  sold: "Продано",
  service: "В ремонті",
  returned: "Повернено",
  archived: "Архів"
};

const conditionLabels: Record<string, string> = {
  new: "Новий",
  like_new: "Як новий",
  good: "Добрий",
  fair: "Задовільний",
  poor: "Поганий"
};

const typeLabels: Record<string, string> = {
  phone: "Телефон",
  tablet: "Планшет",
  laptop: "Ноутбук",
  smartwatch: "Смарт-годинник",
  audio: "Аудіо",
  other: "Інше"
};

export function DeviceDetailView({ device, repairs = [], onEdit, onSell, onClose }: DeviceDetailViewProps) {
  const router = useRouter();
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairRow | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);

  const totalCost = device.cost_price + (device.needs_repair ? device.repair_cost : 0);
  const margin = device.price - totalCost;

  // Safe parse replaced parts
  const replacedParts: Array<{ name: string; cost: number; origin: string }> = Array.isArray(device.repair_parts_replaced)
    ? (device.repair_parts_replaced as Array<{ name: string; cost: number; origin: string }>)
    : typeof device.repair_parts_replaced === "string"
      ? JSON.parse(device.repair_parts_replaced || "[]")
      : [];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{device.id.substring(0, 8)}</span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold`}
                  style={{ 
                    background: `color-mix(in oklch, ${statusColors[device.status] || 'var(--color-iris)'} 15%, transparent)`, 
                    color: statusColors[device.status] 
                  }}>
              {statusLabels[device.status] || device.status}
            </span>
            {device.condition_grade && (
              <span className="rounded-lg bg-violet/5 text-violet px-2.5 py-1 text-[11px] font-semibold">
                {conditionLabels[device.condition_grade] || device.condition_grade}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">
            {device.brand} {device.model}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Категорія: {typeLabels[device.type] || device.type}
          </p>
        </div>
        <div className="flex gap-2">
          {device.status === "in_stock" && onSell && (
            <button
              onClick={onSell}
              className="btn-press flex items-center gap-1.5 rounded-xl bg-violet text-white hover:bg-violet-hover px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
            >
              Продати пристрій
            </button>
          )}
          <button
            onClick={onEdit}
            className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
          >
            <IconEdit size={14} /> Редагувати
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        
        {/* Hardware specifications */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconDevice size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Технічні характеристики</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {device.storage && (
              <div>
                <p className="text-text-muted">Накопичувач</p>
                <p className="mt-1 font-semibold text-text-primary">{device.storage}</p>
              </div>
            )}
            {device.ram && (
              <div>
                <p className="text-text-muted">Оперативна пам&apos;ять (RAM)</p>
                <p className="mt-1 font-semibold text-text-primary">{device.ram}</p>
              </div>
            )}
            {device.battery_health !== null && (
              <div>
                <p className="text-text-muted">Здоров&apos;я батареї (АКБ)</p>
                <p className="mt-1 font-semibold text-text-primary">{device.battery_health}%</p>
              </div>
            )}
            {device.color && (
              <div>
                <p className="text-text-muted">Колір</p>
                <p className="mt-1 font-semibold text-text-primary">{device.color}</p>
              </div>
            )}
            {device.cpu && (
              <div>
                <p className="text-text-muted">Процесор (CPU)</p>
                <p className="mt-1 font-semibold text-text-primary">{device.cpu}</p>
              </div>
            )}
            {device.gpu && (
              <div>
                <p className="text-text-muted">Відеокарта (GPU)</p>
                <p className="mt-1 font-semibold text-text-primary">{device.gpu}</p>
              </div>
            )}
            {device.screen_size && (
              <div>
                <p className="text-text-muted">Діагональ екрану</p>
                <p className="mt-1 font-semibold text-text-primary">{device.screen_size}&quot;</p>
              </div>
            )}
            {device.original_box !== null && (
              <div>
                <p className="text-text-muted">Оригінальна коробка</p>
                <p className="mt-1 font-semibold text-text-primary">{device.original_box ? "Так" : "Ні"}</p>
              </div>
            )}
          </div>
          {device.accessories_included && (
            <div className="border-t border-warm-border pt-3">
              <p className="text-text-muted">Додаткова комплектація</p>
              <p className="mt-1 font-medium text-text-primary">{device.accessories_included}</p>
            </div>
          )}
        </div>

        {/* Identity & Source */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Ідентифікація та Походження</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-text-muted">IMEI / Серійний</p>
              <p className="mt-1 font-mono text-sm font-bold text-text-primary">{device.imei || "—"}</p>
            </div>
            {device.serial_number && (
              <div>
                <p className="text-text-muted">Заводський № (S/N)</p>
                <p className="mt-1 font-mono text-text-primary">{device.serial_number}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 border-t border-warm-border/50 pt-2.5">
              <div>
                <p className="text-text-muted">Джерело надходження</p>
                <p className="mt-1 font-semibold text-text-primary capitalize">{device.source || "—"}</p>
              </div>
              {device.source_reference && (
                <div>
                  <p className="text-text-muted">Референс джерела</p>
                  <p className="mt-1 text-text-primary truncate" title={device.source_reference}>
                    {device.source_reference}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Price and Margin calculation */}
        <div className="card p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconFinance size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Калькуляція вартості та маржі</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-warm-bg rounded-xl p-3">
              <p className="text-[10px] text-text-muted font-medium">Закупівля</p>
              <p className="mt-1 text-sm font-bold text-text-primary">{device.cost_price.toLocaleString()} ₴</p>
            </div>
            <div className="bg-warm-bg rounded-xl p-3">
              <p className="text-[10px] text-text-muted font-medium">Вартість ремонту</p>
              <p className="mt-1 text-sm font-bold text-text-secondary">{device.repair_cost.toLocaleString()} ₴</p>
            </div>
            <div className="bg-warm-bg rounded-xl p-3 border border-violet/10">
              <p className="text-[10px] text-text-muted font-medium">Загальна собівартість</p>
              <p className="mt-1 text-sm font-bold text-violet">{totalCost.toLocaleString()} ₴</p>
            </div>
            <div className="bg-violet-subtle rounded-xl p-3">
              <p className="text-[10px] text-violet font-medium">Маржа (Очікувана)</p>
              <p className="mt-1 text-sm font-bold text-violet">{margin.toLocaleString()} ₴</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-warm-border pt-3">
            <span className="text-text-muted font-medium">Встановлена ціна продажу</span>
            <span className="text-base font-extrabold text-text-primary">{device.price.toLocaleString()} ₴</span>
          </div>
        </div>

        {/* Description & Condition Info */}
        {(device.description || device.condition_description || device.notes) && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2">Опис та примітки</h4>
            {device.description && (
              <div>
                <p className="text-text-muted font-medium">Публічний опис пристрою</p>
                <p className="mt-1 text-text-primary leading-relaxed bg-warm-bg p-3 rounded-lg">{device.description}</p>
              </div>
            )}
            {device.condition_description && (
              <div>
                <p className="text-text-muted font-medium">Деталі про дефекти / стан</p>
                <p className="mt-1 text-text-secondary leading-relaxed italic">{device.condition_description}</p>
              </div>
            )}
            {device.notes && (
              <div className="border-t border-warm-border/50 pt-2.5">
                <p className="text-text-muted font-medium">Внутрішні примітки</p>
                <p className="mt-1 text-text-secondary leading-relaxed">{device.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Repair Section if device needs repair or has history */}
        {(device.needs_repair || replacedParts.length > 0 || repairs.length > 0) && (
          <div className="card p-5 space-y-4 md:col-span-2 border border-violet/10">
            <div className="flex items-center gap-2 border-b border-warm-border pb-3">
              <span className="text-violet"><IconRepair size={18} /></span>
              <h3 className="font-semibold text-sm text-text-primary">Ремонтні роботи та запчастини</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Статистика та поточні показники */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-xs text-text-secondary uppercase tracking-wider mb-2">Поточний стан ремонту</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1">
                      <span className="text-text-muted">Потребує ремонту:</span>
                      <span className="font-semibold text-text-primary">{device.needs_repair ? "Так" : "Ні"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t border-warm-border/40">
                      <span className="text-text-muted">Статус на складі:</span>
                      <span className="font-semibold text-rose capitalize">{device.status === 'service' ? "В ремонті" : "На складі"}</span>
                    </div>
                    {device.repair_node && (
                      <div className="flex justify-between py-1 border-t border-warm-border/40">
                        <span className="text-text-muted">Останній вузол:</span>
                        <span className="font-semibold text-text-primary">{device.repair_node}</span>
                      </div>
                    )}
                    {device.repair_cost > 0 && (
                      <div className="flex justify-between py-1 border-t border-warm-border/40">
                        <span className="text-text-muted font-medium">Витрати на ремонт:</span>
                        <span className="font-bold text-text-primary">{device.repair_cost.toLocaleString()} ₴</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-xs text-text-secondary uppercase tracking-wider mb-2">Замінені деталі</h4>
                  {replacedParts.length === 0 ? (
                    <p className="text-text-muted italic text-[11px] py-1">Деталі не замінювались</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                      {replacedParts.map((part, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1.5 border-b border-warm-border/40 last:border-0 text-xs">
                          <div>
                            <p className="font-medium text-text-primary">{part.name}</p>
                            {part.origin && <p className="text-[9px] text-text-muted mt-0.5">Походження: {part.origin}</p>}
                          </div>
                          <span className="font-semibold text-text-primary">{(part.cost || 0).toLocaleString()} ₴</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Хронологія ремонтів пристрою */}
              <div>
                <h4 className="font-semibold text-xs text-text-secondary uppercase tracking-wider mb-2">Історія внутрішніх ремонтів</h4>
                {repairs.length === 0 ? (
                  <p className="text-text-muted italic text-[11px] py-4">Ремонтів по базі не знайдено</p>
                ) : (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {repairs.map((rep) => (
                      <div 
                        key={rep.id} 
                        onClick={() => setSelectedRepair(rep)}
                        className="rounded-xl border border-warm-border/60 bg-warm-bg/30 p-3.5 space-y-2 text-xs cursor-pointer hover:border-violet/40 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between font-semibold text-text-primary">
                          <span className="font-medium text-[11px] truncate hover:text-violet transition-colors" title={rep.device_name}>{rep.device_name}</span>
                          <span className="rounded bg-violet/5 px-2 py-0.5 text-[10px] text-violet font-semibold capitalize">
                            {rep.status}
                          </span>
                        </div>
                        <p className="text-text-secondary leading-snug"><strong className="text-text-primary">Роботи/Проблема:</strong> {rep.issue}</p>
                        <div className="flex justify-between items-center text-[10px] text-text-secondary border-t border-warm-border/40 pt-2 mt-1">
                          <span>{rep.created_at.split("T")[0]}</span>
                          <span className="font-bold text-text-primary">Собівартість: {rep.cost.toLocaleString()} ₴</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Photos Grid */}
        {device.photo_urls && device.photo_urls.length > 0 && (
          <div className="card p-5 space-y-3 md:col-span-2">
            <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2">Галерея пристрою</h4>
            <div className="flex gap-2 flex-wrap">
              {device.photo_urls.map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt="Device visual review"
                  onClick={() => setActivePhoto(photo)}
                  className="w-16 h-16 object-cover rounded-lg border border-warm-border cursor-zoom-in hover:border-violet transition-colors"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Photo zoom overlay */}
      {activePhoto && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setActivePhoto(null)}
        >
          <img src={activePhoto} alt="Device Zoomed" className="max-w-full max-h-full rounded-lg object-contain" />
        </div>
      )}

      {/* Repair Detail/Edit Drawer */}
      <Drawer
        isOpen={!!selectedRepair}
        onClose={() => { setSelectedRepair(null); setIsEditingRepair(false); }}
        title={isEditingRepair ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selectedRepair && (
          isEditingRepair ? (
            <EditRepairForm 
              onSuccess={() => { setSelectedRepair(null); setIsEditingRepair(false); router.refresh(); }} 
              repair={selectedRepair as unknown as Parameters<typeof EditRepairForm>[0]["repair"]} 
            />
          ) : (
            <RepairDetailView 
              repair={selectedRepair as unknown as Parameters<typeof RepairDetailView>[0]["repair"]} 
              onEdit={() => setIsEditingRepair(true)} 
              onClose={() => setSelectedRepair(null)} 
            />
          )
        )}
      </Drawer>
    </div>
  );
}
