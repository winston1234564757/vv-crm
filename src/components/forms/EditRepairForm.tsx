"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { updateRepair, addPartToRepairAction, removePartFromRepairAction } from "@/lib/actions/repairs";
import NovaPoshtaWidget from "@/components/ui/NovaPoshtaWidget";
import { IconEye, IconEyeOff, IconDelete, IconPlus, IconSpinner } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface RepairData {
  id: string;
  customer_id: string | null;
  customer_name?: string;
  device_name: string;
  device_imei: string | null;
  issue: string;
  status: string;
  price: number;
  cost: number;
  warranty_months: number;
  notes: string | null;
  np_ttn: string | null;
  is_external_sc: boolean;
  external_sc_cost: number;
  markup_amount: number;
  issue_nodes?: string[] | null;
  issue_diagnostics?: string[] | null;
  payment_status?: string | null;
  diagnosis_result?: string | null;
  technician_notes_internal?: string | null;
  device_password?: string | null;
  device_accessories_included?: string | null;
}

const STATUS_OPTIONS = [
  { value: "received", label: "Прийнято" },
  { value: "diagnostics", label: "Діагностика" },
  { value: "in_progress", label: "В роботі" },
  { value: "awaiting_parts", label: "Чекає деталі" },
  { value: "completed", label: "Виконано" },
  { value: "handed_over", label: "Видано клієнту" },
  { value: "cancelled", label: "Скасовано" },
];

const NODE_LABELS: Record<string, string> = {
  display: "Дисплей", battery: "Акумулятор", charging_port: "Порт зарядки",
  speaker: "Динамік/Мікрофон", camera: "Камера", button: "Кнопки",
  housing: "Корпус", water_damage: "Волога", software: "ПЗ/Прошивка", other_node: "Інше",
};

const DIAG_LABELS: Record<string, string> = {
  no_power: "Не вмикається", no_charge: "Не заряджається", no_signal: "Не працює зв'язок",
  cracked_screen: "Розбитий екран", overheating: "Перегрів", auto_restart: "Автоперезавантаження",
  no_sound: "Немає звуку", other_diag: "Інша проблема",
};

export function EditRepairForm({ repair, onSuccess }: { repair: RepairData, onSuccess: () => void }) {
  const initialState = { success: false, error: "" };
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  const [status, setStatus] = useState(repair.status);
  const [paymentStatus, setPaymentStatus] = useState(repair.payment_status ?? "unpaid");
  const [cost, setCost] = useState<string>(repair.cost.toString());
  const [isExternal, setIsExternal] = useState<boolean>(repair.is_external_sc);
  const [externalCost, setExternalCost] = useState<string>(repair.external_sc_cost.toString());
  const [markup, setMarkup] = useState<string>(repair.markup_amount.toString());
  const [price, setPrice] = useState<string>(repair.price.toString());
  const [npTtn, setNpTtn] = useState<string>(repair.np_ttn || "");
  const [notes, setNotes] = useState<string>(repair.notes || "");
  const [showPassword, setShowPassword] = useState(false);

  // Parts Stock Deduction States
  const router = useRouter();
  const [allocatedParts, setAllocatedParts] = useState<Array<{
    id: string;
    part_id: string;
    quantity: number;
    unit_cost: number;
    parts: {
      name: string;
      compatible_with: string | null;
    } | null;
  }>>([]);
  const [availableParts, setAvailableParts] = useState<Array<{
    id: string;
    name: string;
    stock: number;
    cost_price: number;
    compatible_with: string | null;
  }>>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [partQty, setPartQty] = useState<number>(1);
  const [partCost, setPartCost] = useState<string>("");
  const [partsLoading, setPartsLoading] = useState<boolean>(true);
  const [partActionPending, setPartActionPending] = useState<boolean>(false);

  const handlePartSelect = (partId: string) => {
    setSelectedPartId(partId);
    const part = availableParts.find(p => p.id === partId);
    if (part) {
      setPartCost(part.cost_price.toString());
    } else {
      setPartCost("");
    }
  };

  const fetchPartsData = async () => {
    setPartsLoading(true);
    try {
      const supabase = createClient();
      
      // 1. Fetch allocated parts
      const { data: allocated, error: allocErr } = await supabase
        .from("repair_parts")
        .select("id, part_id, quantity, unit_cost, parts(name, compatible_with)")
        .eq("repair_id", repair.id);
        
      if (!allocErr && allocated) {
        setAllocatedParts(allocated as any);
      }

      // 2. Fetch available parts
      const { data: available, error: availErr } = await supabase
        .from("parts")
        .select("id, name, stock, cost_price, compatible_with")
        .gt("stock", 0)
        .order("name");
        
      if (!availErr && available) {
        setAvailableParts(available as any);
      }
    } catch (e) {
      console.error("Помилка завантаження запчастин:", e);
    } finally {
      setPartsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartsData();
  }, [repair.id]);

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartId) return;
    
    const part = availableParts.find(p => p.id === selectedPartId);
    if (!part) return;

    setPartActionPending(true);
    const formData = new FormData();
    formData.append("repairId", repair.id);
    formData.append("partId", selectedPartId);
    formData.append("quantity", partQty.toString());
    formData.append("unitCost", partCost || part.cost_price.toString());

    const res = await addPartToRepairAction(null, formData);
    setPartActionPending(false);

    if (res.success) {
      const addedCost = (parseFloat(partCost) || part.cost_price) * partQty;
      setCost(prev => (parseFloat(prev) + addedCost).toString());
      setSelectedPartId("");
      setPartQty(1);
      setPartCost("");
      fetchPartsData();
      router.refresh();
    } else {
      alert(res.error || "Помилка при списанні деталі");
    }
  };

  const handleRemovePart = async (repairPartId: string, unitCost: number, quantity: number) => {
    if (!confirm("Ви впевнені, що хочете повернути цю деталь на склад?")) return;
    
    setPartActionPending(true);
    const res = await removePartFromRepairAction(repairPartId);
    setPartActionPending(false);

    if (res.success) {
      const removedCost = unitCost * quantity;
      setCost(prev => Math.max(0, parseFloat(prev) - removedCost).toString());
      fetchPartsData();
      router.refresh();
    } else {
      alert(res.error || "Помилка при поверненні деталі");
    }
  };

  const computedPrice = useMemo(() => {
    if (!isExternal) return price;
    return Math.round((parseFloat(cost) || 0) + (parseFloat(externalCost) || 0) + (parseFloat(markup) || 0)).toString();
  }, [isExternal, cost, externalCost, markup, price]);

  async function action(prevState: typeof initialState, formData: FormData) {
    formData.set("id", repair.id);
    formData.set("is_external_sc", isExternal ? "true" : "false");
    formData.set("price", computedPrice);
    const res = await updateRepair(null, formData);
    if (res.success) return { success: true, error: "" };
    return { success: false, error: res.error || "Сталася помилка при збереженні" };
  }

  return (
    <form action={formAction} className="flex flex-col gap-5 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error}
        </div>
      )}
      <div className="rounded-xl border border-warm-border/50 bg-violet/5 p-4 text-xs text-text-primary space-y-1.5">
        <h3 className="font-semibold text-sm mb-1">{repair.device_name}</h3>
        {repair.device_imei && <p className="font-mono text-[10px] text-text-secondary">IMEI: {repair.device_imei}</p>}
        
        {repair.device_password && (
          <div className="flex items-center gap-2">
            <span className="text-text-secondary font-medium">Пароль:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-warm-border font-semibold">
              {showPassword ? repair.device_password : "••••••"}
            </span>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-text-secondary hover:text-text-primary focus:outline-none"
            >
              {showPassword ? <IconEyeOff size={14} /> : <IconEye size={14} />}
            </button>
          </div>
        )}

        {repair.device_accessories_included && (
          <p><strong className="text-text-secondary">Комплектація:</strong> {repair.device_accessories_included}</p>
        )}

        <p><strong className="text-text-secondary">Несправність:</strong> {repair.issue}</p>
        {repair.customer_name && <p><strong className="text-text-secondary">Клієнт:</strong> {repair.customer_name}</p>}
      </div>

      {((repair.issue_nodes ?? []).length > 0 || (repair.issue_diagnostics ?? []).length > 0) && (
        <div className="space-y-2">
          {(repair.issue_nodes ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5">Вузли ремонту</p>
              <div className="flex flex-wrap gap-1.5">
                {(repair.issue_nodes ?? []).map((n: string) => (
                  <span key={n} className="rounded bg-violet/10 px-2 py-0.5 text-[11px] font-medium text-violet">
                    {NODE_LABELS[n] || n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(repair.issue_diagnostics ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1.5">Діагностика</p>
              <div className="flex flex-wrap gap-1.5">
                {(repair.issue_diagnostics ?? []).map((n: string) => (
                  <span key={n} className="rounded bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
                    {DIAG_LABELS[n] || n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="status" className="mb-1.5 block text-xs font-medium text-text-secondary">Статус ремонту</label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet focus:ring-1 focus:ring-violet"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="payment_status" className="mb-1.5 block text-xs font-medium text-text-secondary">Статус оплати</label>
            <select id="payment_status" name="payment_status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet focus:ring-1 focus:ring-violet">
              <option value="unpaid">Не оплачено</option>
              <option value="paid">Оплачено</option>
              <option value="partial">Частково</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="np_ttn" className="mb-1.5 block text-xs font-medium text-text-secondary flex items-center justify-between">
            <span>ТТН Нової Пошти (пристрою)</span>
            {npTtn && (
              <a
                href={`https://novaposhta.ua/tracking/?cargo_number=${npTtn}`}
                target="_blank"
                rel="noreferrer"
                className="text-violet hover:underline font-semibold text-[10px]"
              >
                Відстежити ↗
              </a>
            )}
          </label>
          <input
            id="np_ttn"
            name="np_ttn"
            type="text"
            value={npTtn}
            onChange={(e) => setNpTtn(e.target.value)}
            placeholder="2045XXXXXXXXXX"
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          />
          {npTtn && npTtn.trim().length >= 10 && (
            <div className="mt-2.5">
              <NovaPoshtaWidget ttn={npTtn} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 py-1">
        <input 
          id="is_external_sc_toggle" 
          type="checkbox" 
          checked={isExternal} 
          onChange={(e) => setIsExternal(e.target.checked)} 
          className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet" 
        />
        <label htmlFor="is_external_sc_toggle" className="text-sm font-medium text-text-primary cursor-pointer">
          Ремонт у сторонньому СЦ (інше місто / складна пайка)
        </label>
      </div>

      {isExternal ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 p-4 rounded-xl bg-violet/5 border border-violet/10">
          <div>
            <label htmlFor="cost" className="mb-1.5 block text-xs font-medium text-text-secondary">Собівартість деталей (грн)</label>
            <input id="cost" name="cost" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
          </div>
          <div>
            <label htmlFor="external_sc_cost" className="mb-1.5 block text-xs font-medium text-text-secondary">Вартість їх роботи (СЦ) (грн)</label>
            <input id="external_sc_cost" name="external_sc_cost" type="number" min="0" value={externalCost} onChange={(e) => setExternalCost(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
          </div>
          <div>
            <label htmlFor="markup_amount" className="mb-1.5 block text-xs font-medium text-text-secondary">Наша націнка (грн)</label>
            <input id="markup_amount" name="markup_amount" type="number" min="0" value={markup} onChange={(e) => setMarkup(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="cost" className="mb-1.5 block text-xs font-medium text-text-secondary">Собівартість деталей (грн)</label>
            <input id="cost" name="cost" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
          </div>
          <div>
            <label htmlFor="price" className="mb-1.5 block text-xs font-medium text-text-secondary">Загальна ціна для клієнта (грн)</label>
            <input id="price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
          </div>
        </div>
      )}

      {isExternal && (
        <div className="rounded-xl bg-iris/5 border border-iris/10 px-4 py-3 text-xs text-text-secondary flex items-center justify-between">
          <span>Авторозрахована ціна для клієнта:</span>
          <span className="font-semibold text-sm text-text-primary">{computedPrice} грн</span>
        </div>
      )}

      {/* Списання запчастин зі складу */}
      <div className="rounded-xl border border-iris/20 bg-violet/5 p-4.5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <span>Використані запчастини зі складу</span>
            {partsLoading && <IconSpinner className="h-4 w-4 animate-spin text-violet" />}
          </h4>
          <span className="text-[11px] font-medium text-text-secondary bg-iris/10 px-2 py-0.5 rounded">
            Складський облік
          </span>
        </div>

        {/* Список виділених запчастин */}
        {!partsLoading && allocatedParts.length === 0 ? (
          <p className="text-xs text-text-secondary/60 italic py-2">Запчастини зі складу не списані для цього ремонту.</p>
        ) : (
          <div className="space-y-2.5">
            {allocatedParts.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-white border border-warm-border/50 px-3.5 py-2.5 text-xs text-text-primary hover:border-violet/30 transition-all duration-200"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">{item.parts?.name || "Невідома запчастина"}</span>
                  {item.parts?.compatible_with && (
                    <span className="text-[10px] text-text-secondary">
                      Сумісність: {item.parts.compatible_with}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="font-medium text-text-secondary">
                      {item.quantity} шт. × {item.unit_cost} грн
                    </span>
                    <p className="font-bold text-violet">{item.quantity * item.unit_cost} грн</p>
                  </div>
                  <button
                    type="button"
                    disabled={partActionPending}
                    onClick={() => handleRemovePart(item.id, item.unit_cost, item.quantity)}
                    className="p-1.5 rounded-lg text-rose hover:bg-rose/10 transition-colors focus:outline-none disabled:opacity-50"
                    title="Повернути деталь на склад"
                  >
                    <IconDelete size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Форма додавання запчастини */}
        <div className="pt-2 border-t border-iris/10">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Оберіть деталь</label>
                <select
                  value={selectedPartId}
                  onChange={(e) => handlePartSelect(e.target.value)}
                  disabled={partsLoading || partActionPending}
                  className="w-full rounded-xl border border-iris/20 bg-white px-3 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                >
                  <option value="">-- Виберіть зі складу --</option>
                  {availableParts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name} ({part.stock} шт.) {part.compatible_with ? `[${part.compatible_with}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Кількість (шт.)</label>
                <input
                  type="number"
                  min="1"
                  max={selectedPartId ? (availableParts.find(p => p.id === selectedPartId)?.stock || 1) : 1}
                  value={partQty}
                  onChange={(e) => setPartQty(parseInt(e.target.value) || 1)}
                  disabled={!selectedPartId || partActionPending}
                  className="w-full rounded-xl border border-iris/20 bg-white px-3 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-text-secondary">Собівартість (грн)</label>
                <input
                  type="number"
                  min="0"
                  placeholder={selectedPartId ? (availableParts.find(p => p.id === selectedPartId)?.cost_price.toString() || "") : "0"}
                  value={partCost}
                  onChange={(e) => setPartCost(e.target.value)}
                  disabled={!selectedPartId || partActionPending}
                  className="w-full rounded-xl border border-iris/20 bg-white px-3 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddPart}
              disabled={!selectedPartId || partActionPending}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-violet/90 text-white px-4 py-2.5 text-xs font-semibold hover:bg-violet transition-colors focus:outline-none disabled:opacity-50"
            >
              {partActionPending ? (
                <>
                  <IconSpinner className="h-3.5 w-3.5 animate-spin" />
                  <span>Обробка...</span>
                </>
              ) : (
                <>
                  <IconPlus size={14} />
                  <span>Списати запчастину на ремонт</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-text-secondary">Коментар / Нотатки</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Деталі, додаткова інформація..."
          className="w-full resize-none rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
        />
      </div>

      <div>
        <label htmlFor="diagnosis_result" className="mb-1.5 block text-xs font-medium text-text-secondary">Результат діагностики</label>
        <textarea id="diagnosis_result" name="diagnosis_result" rows={2} defaultValue={repair.diagnosis_result ?? ""} placeholder="Висновки після діагностики..." className="w-full resize-none rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
      </div>
      <div>
        <label htmlFor="technician_notes_internal" className="mb-1.5 block text-xs font-medium text-text-secondary">Нотатки майстра (внутрішні)</label>
        <textarea id="technician_notes_internal" name="technician_notes_internal" rows={2} defaultValue={repair.technician_notes_internal ?? ""} placeholder="Не показується клієнту в трекінгу..." className="w-full resize-none rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 text-sm text-text-primary outline-none focus:border-amber" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? <span className="animate-pulse opacity-60">Зачекайте...</span> : "Зберегти зміни"}
      </button>
    </form>
  );
}
