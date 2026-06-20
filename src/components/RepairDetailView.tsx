"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { 
  IconClose, IconEdit, IconCheck, IconEye, IconEyeOff, 
  IconCustomer, IconDevice, IconFinance, IconBox, IconSpinner
} from "./icons";
import { createClient } from "@/lib/supabase/client";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import { addPartToRepairAction, removePartFromRepairAction } from "@/lib/actions/repairs";

type RepairDetailViewProps = {
  repair: {
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
    tracking_token?: string | null;
  };
  onEdit: () => void;
  onClose: () => void;
};

const statusLabels: Record<string, string> = {
  received: "Прийнято", diagnostics: "Діагностика", in_progress: "В роботі",
  awaiting_parts: "Чекає деталі", ready: "Готовий", completed: "Виконано", handed_over: "Видано", cancelled: "Скасовано",
};

const statusColors: Record<string, string> = {
  received: "var(--color-iris)", diagnostics: "var(--color-amber)", in_progress: "var(--color-violet)",
  awaiting_parts: "var(--color-rose)", ready: "var(--color-cyan)", completed: "var(--color-iris)", handed_over: "var(--color-iris)", cancelled: "var(--color-iris)",
};

const paymentLabels: Record<string, string> = { unpaid: "Не оплачено", paid: "Оплачено", partial: "Частково" };
const paymentColors: Record<string, string> = { unpaid: "text-rose bg-rose/10", paid: "text-cyan bg-cyan/10", partial: "text-amber bg-amber/10" };

interface RepairStatusLog {
  id: string;
  created_at: string;
  repair_id: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  profiles: {
    full_name: string | null;
    role: string | null;
  } | null;
}

export function RepairDetailView({ repair, onEdit, onClose }: RepairDetailViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [logs, setLogs] = useState<RepairStatusLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  // States for warehouse parts
  const [currentCost, setCurrentCost] = useState(repair.cost);
  const [allocatedParts, setAllocatedParts] = useState<any[]>([]);
  const [availableParts, setAvailableParts] = useState<any[]>([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [partsError, setPartsError] = useState("");

  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQuantity, setPartQuantity] = useState(1);
  const [partUnitCost, setPartUnitCost] = useState(0);
  const [isSubmittingPart, setIsSubmittingPart] = useState(false);

  // States for interactive print modal
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [printType, setPrintType] = useState<"repair_acceptance" | "repair_warranty">("repair_acceptance");

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("repair_status_log")
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq("repair_id", repair.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error loading status logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function loadParts() {
    setLoadingParts(true);
    setPartsError("");
    try {
      const supabase = createClient();
      
      // 1. Load allocated parts
      const { data: allocData, error: allocErr } = await supabase
        .from("repair_parts")
        .select(`
          id,
          quantity,
          unit_cost,
          part_id,
          parts (
            name,
            compatible_with
          )
        `)
        .eq("repair_id", repair.id);
      
      if (allocErr) throw allocErr;
      setAllocatedParts(allocData || []);

      // 2. Load available warehouse parts
      const { data: stockData, error: stockErr } = await supabase
        .from("parts")
        .select("id, name, compatible_with, cost_price, stock")
        .gt("stock", 0)
        .order("name", { ascending: true });

      if (stockErr) throw stockErr;
      setAvailableParts(stockData || []);
    } catch (err) {
      console.error("Error loading repair parts:", err);
      setPartsError("Не вдалося завантажити дані деталей зі складу");
    } finally {
      setLoadingParts(false);
    }
  }

  useEffect(() => {
    loadLogs();
    loadParts();
  }, [repair.id]);

  function handlePrint(type: "acceptance" | "warranty") {
    setPrintType(type === "acceptance" ? "repair_acceptance" : "repair_warranty");
    setIsPrintOpen(true);
  }

  const handlePartSelectChange = (partId: string) => {
    setSelectedPartId(partId);
    const part = availableParts.find(p => p.id === partId);
    if (part) {
      setPartUnitCost(part.cost_price);
      setPartQuantity(1);
    } else {
      setPartUnitCost(0);
      setPartQuantity(1);
    }
  };

  async function handleAddPart(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPartId || partQuantity < 1) return;

    setIsSubmittingPart(true);
    setPartsError("");
    try {
      const formData = new FormData();
      formData.set("repairId", repair.id);
      formData.set("partId", selectedPartId);
      formData.set("quantity", partQuantity.toString());
      formData.set("unitCost", partUnitCost.toString());

      const res = await addPartToRepairAction(null, formData);
      if (res.success) {
        setCurrentCost(prev => prev + (partUnitCost * partQuantity));
        setSelectedPartId("");
        setPartQuantity(1);
        setPartUnitCost(0);
        await Promise.all([loadParts(), loadLogs()]);
      } else {
        setPartsError(res.error || "Не вдалося додати деталь");
      }
    } catch (err) {
      setPartsError("Сталася непередбачена помилка");
    } finally {
      setIsSubmittingPart(false);
    }
  }

  async function handleRemovePart(allocatedPartId: string) {
    if (!confirm("Ви впевнені, що хочете повернути цю деталь на склад?")) return;

    setPartsError("");
    try {
      const p = allocatedParts.find(x => x.id === allocatedPartId);
      const res = await removePartFromRepairAction(allocatedPartId);
      if (res.success) {
        if (p) {
          setCurrentCost(prev => Math.max(0, prev - (p.unit_cost * p.quantity)));
        }
        await Promise.all([loadParts(), loadLogs()]);
      } else {
        setPartsError(res.error || "Не вдалося видалити деталь");
      }
    } catch (err) {
      setPartsError("Не вдалося видалити деталь");
    }
  }

  const createdDate = new Date(repair.created_at);
  const formattedCreated = format(createdDate, "dd MMMM yyyy 'о' HH:mm", { locale: uk });
  const formattedEstimated = repair.estimated_completion 
    ? format(new Date(repair.estimated_completion), "dd MMMM yyyy", { locale: uk })
    : null;

  const profit = repair.price - currentCost;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-warm-surface border border-warm-border p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">#{repair.id.substring(0, 8)}</span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold`}
                  style={{ 
                    background: `color-mix(in oklch, ${statusColors[repair.status] || 'var(--color-iris)'} 15%, transparent)`, 
                    color: statusColors[repair.status] 
                  }}>
              {statusLabels[repair.status]}
            </span>
            <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${paymentColors[repair.payment_status ?? ''] || ''}`}>
              {paymentLabels[repair.payment_status ?? 'unpaid']}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-text-primary">{repair.device_name}</h2>
          <p className="mt-1 text-xs text-text-secondary">Прийнято: {formattedCreated}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors cursor-pointer"
          >
            <IconEdit size={14} /> Редагувати
          </button>
        </div>
      </div>

      {/* Bento Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Device State Info Card */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconDevice size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Стан пристрою</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-text-muted">IMEI / Серійний</p>
              <p className="mt-1 font-mono font-medium text-text-primary">{repair.device_imei || "—"}</p>
            </div>
            <div>
              <p className="text-text-muted">Комплектація</p>
              <p className="mt-1 font-medium text-text-primary">{repair.device_accessories_included || "Тільки пристрій"}</p>
            </div>
            <div>
              <p className="text-text-muted">Стан</p>
              <p className="mt-1 font-medium text-text-primary capitalize">
                {repair.device_condition === "perfect" ? "Ідеальний" :
                 repair.device_condition === "good" ? "Добрий" :
                 repair.device_condition === "fair" ? "Задовільний" :
                 repair.device_condition === "poor" ? "Поганий" :
                 repair.device_condition === "damaged" ? "Пошкоджений" : "Не вказано"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-text-muted">
                <span>Пароль</span>
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-violet hover:text-violet-hover p-0.5 rounded cursor-pointer"
                >
                  {showPassword ? <IconEyeOff size={12} /> : <IconEye size={12} />}
                </button>
              </div>
              <p className="mt-1 font-mono font-medium text-text-primary">
                {showPassword ? (repair.device_password || "Без паролю") : "••••••••"}
              </p>
            </div>
          </div>
          {repair.device_condition_description && (
            <div className="border-t border-warm-border pt-3 text-xs">
              <p className="text-text-muted">Опис стану пристрою</p>
              <p className="mt-1 font-medium text-text-primary">{repair.device_condition_description}</p>
            </div>
          )}
          
          {/* Photos of device condition */}
          {repair.device_condition_photos && repair.device_condition_photos.length > 0 && (
            <div className="border-t border-warm-border pt-3">
              <p className="text-xs text-text-muted mb-2">Фото прийманння</p>
              <div className="flex gap-2 flex-wrap">
                {repair.device_condition_photos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt="Device condition"
                    onClick={() => setActivePhoto(photo)}
                    className="w-14 h-14 object-cover rounded-lg border border-warm-border cursor-zoom-in hover:border-violet transition-colors"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Client & Billing Info Card */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconCustomer size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Клієнт та Розрахунок</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted">Клієнт</span>
              <div className="text-right">
                <p className="font-semibold text-text-primary">{repair.customer_name}</p>
                <a 
                  href={`tel:${repair.customer_phone}`}
                  className="font-mono text-violet hover:underline"
                >
                  {repair.customer_phone}
                </a>
              </div>
            </div>
            {repair.customer_telegram && (
              <div className="flex justify-between items-center text-xs border-t border-warm-border pt-2">
                <span className="text-text-muted">Telegram ID</span>
                <span className="text-text-primary font-mono">{repair.customer_telegram}</span>
              </div>
            )}
            
            <div className="border-t border-warm-border pt-3">
              <h4 className="text-xs font-semibold text-text-secondary mb-2">Фінансовий звіт</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-warm-bg rounded-xl p-2.5">
                  <p className="text-[10px] text-text-muted font-medium">Вартість</p>
                  <p className="mt-1 font-bold text-text-primary">{repair.price.toLocaleString()} ₴</p>
                </div>
                <div className="bg-warm-bg rounded-xl p-2.5">
                  <p className="text-[10px] text-text-muted font-medium">Собівартість</p>
                  <p className="mt-1 font-bold text-text-secondary">{currentCost.toLocaleString()} ₴</p>
                </div>
                <div className="bg-violet-subtle rounded-xl p-2.5">
                  <p className="text-[10px] text-violet font-medium">Прибуток</p>
                  <p className="mt-1 font-bold text-violet">{profit.toLocaleString()} ₴</p>
                </div>
              </div>
            </div>

            <div className="border-t border-warm-border pt-3 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-text-muted">Гарантія</p>
                <p className="mt-1 font-semibold text-text-primary">{repair.warranty_months} міс.</p>
              </div>
              {formattedEstimated && (
                <div>
                  <p className="text-text-muted">Очікувана готовність</p>
                  <p className="mt-1 font-semibold text-text-primary">{formattedEstimated}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Issue Details Card */}
        <div className="card p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Опис поломки та діагностики</h3>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <p className="text-text-muted font-medium">Заявлена несправність</p>
              <p className="mt-1.5 text-text-primary bg-warm-bg rounded-xl p-3 leading-relaxed">{repair.issue}</p>
            </div>
            
            {(repair.issue_nodes && repair.issue_nodes.length > 0) && (
              <div>
                <p className="text-text-muted font-medium mb-1.5">Вузли ремонту</p>
                <div className="flex gap-1.5 flex-wrap">
                  {repair.issue_nodes.map((node, idx) => (
                    <span key={idx} className="bg-violet/5 text-violet px-2.5 py-1 rounded-lg font-medium text-[11px]">
                      {node}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(repair.issue_diagnostics && repair.issue_diagnostics.length > 0) && (
              <div>
                <p className="text-text-muted font-medium mb-1.5">Результати діагностики</p>
                <div className="flex gap-1.5 flex-wrap">
                  {repair.issue_diagnostics.map((diag, idx) => (
                    <span key={idx} className="bg-amber/10 text-amber px-2.5 py-1 rounded-lg font-medium text-[11px]">
                      {diag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {repair.notes && (
              <div>
                <p className="text-text-muted font-medium">Нотатки майстра</p>
                <p className="mt-1.5 text-text-secondary italic">{repair.notes}</p>
              </div>
            )}

            {repair.np_ttn && (
              <div className="border-t border-warm-border pt-3">
                <p className="text-text-muted font-medium">ТТН Нової Пошти</p>
                <a
                  href={`https://novaposhta.ua/tracking/?cargo_number=${repair.np_ttn}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-violet hover:underline font-semibold"
                >
                  {repair.np_ttn} ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Warehouse Parts Card */}
        <div className="card p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between border-b border-warm-border pb-3">
            <div className="flex items-center gap-2">
              <span className="text-violet"><IconBox size={18} /></span>
              <h3 className="font-semibold text-sm text-text-primary">Запчастини згідно зі складом</h3>
            </div>
            {partsError && <p className="text-xs text-rose font-medium">{partsError}</p>}
          </div>

          <div className="space-y-4 text-xs">
            {/* List of allocated parts */}
            {loadingParts ? (
              <div className="flex items-center justify-center py-4 text-violet">
                <IconSpinner className="animate-spin" />
              </div>
            ) : allocatedParts.length === 0 ? (
              <p className="text-xs text-text-secondary text-center py-2">Немає списаних деталей на цей ремонт</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-warm-border/50 text-text-secondary font-medium">
                      <th className="pb-2">Назва деталі</th>
                      <th className="pb-2">Сумісність</th>
                      <th className="pb-2 text-center">Кількість</th>
                      <th className="pb-2 text-right">Ціна од.</th>
                      <th className="pb-2 text-right">Сума</th>
                      <th className="pb-2 text-right">Дія</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocatedParts.map((p) => {
                      const detail = p.parts as unknown as { name: string; compatible_with: string | null } | null;
                      return (
                        <tr key={p.id} className="border-b border-warm-border/30 last:border-0 text-text-primary">
                          <td className="py-2.5 font-medium">{detail?.name || "Деталь"}</td>
                          <td className="py-2.5 text-text-secondary">{detail?.compatible_with || "—"}</td>
                          <td className="py-2.5 text-center font-mono font-semibold">{p.quantity} шт</td>
                          <td className="py-2.5 text-right font-mono">{p.unit_cost.toLocaleString()} ₴</td>
                          <td className="py-2.5 text-right font-mono font-bold">{(p.unit_cost * p.quantity).toLocaleString()} ₴</td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemovePart(p.id)}
                              className="btn-press rounded-lg p-1 text-rose hover:bg-rose/10 cursor-pointer"
                              title="Повернути на склад"
                            >
                              <IconClose size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inline Allocation Form */}
            <form onSubmit={handleAddPart} className="pt-4 border-t border-warm-border/50 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="mb-1 block text-[10px] font-bold text-text-secondary">Обрати деталь зі складу</label>
                <select
                  value={selectedPartId}
                  onChange={(e) => handlePartSelectChange(e.target.value)}
                  className="w-full rounded-xl border border-iris/20 bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet"
                >
                  <option value="">-- Оберіть запчастину --</option>
                  {availableParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.compatible_with ? `(${p.compatible_with})` : ""} — {p.stock} шт
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-bold text-text-secondary">Кількість</label>
                <input
                  type="number"
                  min="1"
                  max={selectedPartId ? (availableParts.find(p => p.id === selectedPartId)?.stock || 1) : 1}
                  value={partQuantity}
                  onChange={(e) => setPartQuantity(Number(e.target.value))}
                  className="w-full rounded-xl border border-iris/20 bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet text-center"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-[10px] font-bold text-text-secondary">Собівартість од. (₴)</label>
                <input
                  type="number"
                  min="0"
                  value={partUnitCost}
                  onChange={(e) => setPartUnitCost(Number(e.target.value))}
                  className="w-full rounded-xl border border-iris/20 bg-transparent px-3 py-2 text-xs text-text-primary outline-none focus:border-violet text-right font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmittingPart || !selectedPartId}
                  className="w-full btn-press flex items-center justify-center rounded-xl bg-violet py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-hover disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPart ? "..." : "Додати"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Timeline Logs Card */}
        <div className="card p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-warm-border pb-3">
            <span className="text-violet"><IconBox size={18} /></span>
            <h3 className="font-semibold text-sm text-text-primary">Хронологія ремонтних робіт</h3>
          </div>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-6 text-violet">
              <IconSpinner className="animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-4">Немає зареєстрованих дій</p>
          ) : (
            <div className="relative border-l border-warm-border ml-2 pl-4 py-2 space-y-5 text-xs">
              {logs.map((log) => {
                const date = new Date(log.created_at);
                const timeStr = format(date, "dd.MM.yyyy HH:mm");
                return (
                  <div key={log.id} className="relative">
                    <span className="absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white"
                          style={{ backgroundColor: statusColors[log.to_status] || "var(--color-iris)" }} />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text-primary">
                          Встановлено статус &ldquo;{statusLabels[log.to_status] || log.to_status}&rdquo;
                        </span>
                        {log.from_status && (
                          <span className="text-[10px] text-text-muted">
                            (із &ldquo;{statusLabels[log.from_status] || log.from_status}&rdquo;)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted">{timeStr}</span>
                      {log.notes && <p className="mt-1 text-text-secondary italic bg-warm-bg rounded-lg p-2">{log.notes}</p>}
                      {log.profiles && (
                        <span className="text-[9px] text-text-muted mt-0.5">
                          Виконавець: {log.profiles.full_name} ({log.profiles.role === "owner" ? "Власник" : log.profiles.role === "technician" ? "Технік" : "Менеджер"})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Print Layout Trigger Buttons */}
        <div className="card p-5 space-y-3 md:col-span-2">
          <h4 className="font-semibold text-xs text-text-primary">Друк квитанцій та документів</h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handlePrint("acceptance")}
              className="btn-press flex items-center gap-1.5 rounded-xl bg-violet text-white hover:bg-violet-hover px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
            >
              Друк квитанції приймання
            </button>
            <button
              onClick={() => handlePrint("warranty")}
              className="btn-press flex items-center gap-1.5 rounded-xl border border-warm-border bg-white hover:bg-warm-hover px-4 py-2.5 text-xs font-semibold text-text-primary cursor-pointer transition-colors"
            >
              Друк гарантійного чеку ремонту
            </button>
          </div>
        </div>

      </div>

      {/* Reusable Print Modal for Repair Receipts */}
      <ReceiptPrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        type={printType}
        data={{
          id: repair.id,
          created_at: repair.created_at,
          customer_name: repair.customer_name,
          customer_phone: repair.customer_phone,
          seller_name: logs.find(log => log.to_status === "received")?.profiles?.full_name || "майстер Олександр",
          device_name: repair.device_name,
          device_imei: repair.device_imei,
          device_accessories_included: repair.device_accessories_included,
          device_condition: repair.device_condition,
          issue: repair.issue,
          warranty_months: repair.warranty_months,
          tracking_token: repair.tracking_token,
          price: repair.price,
          // For warranty receipt: parts from warehouse + main service
          repairItems: [
            // Main service (repair work itself)
            ...(repair.price > 0 ? [{
              name: repair.issue || "Ремонтні роботи",
              quantity: 1,
              unit_price: repair.price - allocatedParts.reduce((s: number, p: { unit_cost: number; quantity: number }) => s + (p.unit_cost * p.quantity), 0),
            }] : []),
            // Allocated warehouse parts
            ...allocatedParts.map((p: { parts: { name: string; compatible_with: string | null }; quantity: number; unit_cost: number }) => ({
              name: p.parts?.name + (p.parts?.compatible_with ? ` (${p.parts.compatible_with})` : ""),
              quantity: p.quantity,
              unit_price: p.unit_cost,
            })),
          ].filter(item => item.unit_price > 0),
        }}
      />
    </div>
  );
}


