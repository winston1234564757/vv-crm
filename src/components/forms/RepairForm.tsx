"use client";

import { useActionState, useEffect, useState } from "react";
import { createRepair } from "@/lib/actions/repairs";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import SearchSelect from "@/components/ui/SearchSelect";
import { IconEye, IconEyeOff } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

const ISSUE_NODES = [
  { value: "display", label: "Дисплей" },
  { value: "battery", label: "Акумулятор" },
  { value: "charging_port", label: "Порт зарядки" },
  { value: "speaker", label: "Динамік / Мікрофон" },
  { value: "camera", label: "Камера" },
  { value: "button", label: "Кнопки" },
  { value: "housing", label: "Корпус" },
  { value: "water_damage", label: "Волога" },
  { value: "software", label: "Прошивка / ПЗ" },
  { value: "other_node", label: "Інше" },
];

const ISSUE_DIAGNOSTICS = [
  { value: "no_power", label: "Не вмикається" },
  { value: "no_charge", label: "Не заряджається" },
  { value: "no_signal", label: "Не працює зв'язок" },
  { value: "cracked_screen", label: "Розбитий екран" },
  { value: "overheating", label: "Перегрів" },
  { value: "auto_restart", label: "Самостійно перезавантажується" },
  { value: "no_sound", label: "Немає звуку" },
  { value: "other_diag", label: "Інша проблема" },
];

export function RepairForm({ customers, onSuccess }: { customers: Customer[], onSuccess: () => void }) {
  const initialState = { success: false, error: "" };
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  const [custError, setCustError] = useState("");
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<string[]>([]);

  function toggleNode(value: string) {
    setSelectedNodes(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function toggleDiagnostic(value: string) {
    setSelectedDiagnostics(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  const [source, setSource] = useState("store");
  const [promoCode, setPromoCode] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [promoMessage, setPromoMessage] = useState<{text: string, type: "success" | "error"} | null>(null);

  async function handleCheckPromo() {
    if (!promoCode.trim()) return;
    setPromoMessage(null);
    const res = await validatePromoCode(promoCode.trim());
    if (res.success && res.partner) {
      setPartnerId(res.partner.id);
      setPromoMessage({ text: `Знайдено партнера: ${res.partner.name}. Знижка ${res.partner.discount_percent}%!`, type: "success" });
    } else {
      setPartnerId("");
      setPromoMessage({ text: res.error || "Промокод не знайдено", type: "error" });
    }
  }

  async function handleCreateCustomer() {
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    setCustError("");
    const formData = new FormData();
    formData.set("name", newCustName);
    formData.set("phone", newCustPhone);
    formData.set("email", newCustEmail);
    const res = await createCustomer({ success: false, error: "" }, formData);
    if (res.success && res.data) {
      const created = res.data as Customer;
      setLocalCustomers(prev => [...prev, created]);
      setSelectedCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
    } else {
      setCustError(res.error || "Помилка створення клієнта");
    }
  }

  function handleCustomerSelect(id: string) {
    if (id === "__new__") {
      setShowNewCustomer(true);
      setSelectedCustomerId("");
      return;
    }
    setShowNewCustomer(false);
    setSelectedCustomerId(id);
  }

  async function action(prevState: typeof initialState, formData: FormData) {
    formData.set("issue_nodes", JSON.stringify(selectedNodes));
    formData.set("issue_diagnostics", JSON.stringify(selectedDiagnostics));
    formData.set("customer_id", selectedCustomerId);
    if (partnerId) {
      formData.set("partner_id", partnerId);
      formData.set("promo_code_used", promoCode.trim());
    }
    const res = await createRepair(null, formData);
    if (res.success) return { success: true, error: "" };
    return { success: false, error: res.error || "Сталася помилка" };
  }

  const selectOptions = [
    ...localCustomers.map(c => ({ id: c.id, label: `${c.name} (${c.phone})` })),
    { id: "__new__", label: "+ Новий клієнт" }
  ];

  return (
    <form action={formAction} className="flex flex-col gap-5 p-5">
      {(state.error || custError) && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error || custError}
        </div>
      )}

      <div>
        <SearchSelect
          label="Клієнт"
          name="customer_id"
          options={selectOptions}
          value={selectedCustomerId}
          onChange={handleCustomerSelect}
          placeholder="Оберіть клієнта..."
          required
        />
        {showNewCustomer && (
          <div className="mt-3 rounded-xl border border-violet/20 bg-violet/5 p-4 space-y-3">
            <p className="text-xs font-medium text-text-secondary">Новий клієнт</p>
            <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Ім'я *" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="Телефон *" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="Email (опціонально)" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            <button type="button" onClick={handleCreateCustomer} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
              Створити клієнта
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Вузол ремонту (оберіть що потребує ремонту)</label>
        <div className="flex flex-wrap gap-2">
          {ISSUE_NODES.map(node => (
            <button
              key={node.value}
              type="button"
              onClick={() => toggleNode(node.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedNodes.includes(node.value)
                  ? "bg-violet text-white border-violet"
                  : "bg-transparent text-text-secondary border-iris/20 hover:border-violet/40"
              }`}
            >
              {node.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="issue_nodes" value={JSON.stringify(selectedNodes)} />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Діагностика (симптоми)</label>
        <div className="flex flex-wrap gap-2">
          {ISSUE_DIAGNOSTICS.map(diag => (
            <button
              key={diag.value}
              type="button"
              onClick={() => toggleDiagnostic(diag.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                selectedDiagnostics.includes(diag.value)
                  ? "bg-amber/80 text-white border-amber"
                  : "bg-transparent text-text-secondary border-iris/20 hover:border-amber/40"
              }`}
            >
              {diag.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="issue_diagnostics" value={JSON.stringify(selectedDiagnostics)} />
      </div>

      <div>
        <label htmlFor="device_name" className="mb-1.5 block text-xs font-medium text-text-secondary">Пристрій (Модель)</label>
        <input
          id="device_name"
          name="device_name"
          required
          type="text"
          placeholder="Напр. iPhone 13 Pro Max"
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="device_password" className="mb-1.5 block text-xs font-medium text-text-secondary">Пароль пристрою (якщо є)</label>
          <div className="relative">
            <input
              id="device_password"
              name="device_password"
              type={showPassword ? "text" : "password"}
              placeholder="Код блокування, iCloud..."
              className="w-full rounded-xl border border-iris/20 bg-transparent pl-4 pr-10 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary focus:outline-none"
            >
              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="device_accessories_included" className="mb-1.5 block text-xs font-medium text-text-secondary">Комплектація (що здав клієнт)</label>
          <input id="device_accessories_included" name="device_accessories_included" type="text" placeholder="Зарядка, чохол, коробка..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
        </div>
      </div>

      <div>
        <label htmlFor="device_imei" className="mb-1.5 block text-xs font-medium text-text-secondary">IMEI / Серійний номер (опціонально)</label>
        <input
          id="device_imei"
          name="device_imei"
          type="text"
          placeholder="IMEI або S/N"
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="source" className="mb-1.5 block text-xs font-medium text-text-secondary">Звідки звернувся</label>
          <select id="source" name="source" value={source} onChange={(e) => setSource(e.target.value)} required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet">
            <option value="store">Прийшов у магазин</option>
            <option value="online">Онлайн (сайт/месенджер)</option>
            <option value="recommendation">За рекомендацією (Промокод)</option>
          </select>
          {source === "recommendation" && (
            <div className="mt-3 p-3 rounded-xl bg-violet/5 border border-violet/20 space-y-2">
              <label className="block text-xs font-medium text-violet">Введіть промокод партнера</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoCode} 
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="VVC-XXXX"
                  className="flex-1 rounded-lg border border-iris/20 bg-white px-3 py-2 text-sm uppercase font-mono outline-none focus:border-violet" 
                />
                <button type="button" onClick={handleCheckPromo} className="rounded-lg bg-violet px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-hover">
                  Перевірити
                </button>
              </div>
              {promoMessage && (
                <p className={`text-xs font-medium ${promoMessage.type === "success" ? "text-emerald" : "text-rose"}`}>
                  {promoMessage.text}
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="estimated_completion" className="mb-1.5 block text-xs font-medium text-text-secondary">Орієнтовна дата готовності</label>
          <input id="estimated_completion" name="estimated_completion" type="date" className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet" />
        </div>
      </div>

      <div>
        <label htmlFor="issue" className="mb-1.5 block text-xs font-medium text-text-secondary">Опис проблеми</label>
        <textarea
          id="issue"
          name="issue"
          required
          rows={3}
          placeholder="Детальний опис поломки та стану пристрою..."
          className="w-full resize-none rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="mb-1.5 block text-xs font-medium text-text-secondary">Орієнтовна вартість (грн)</label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            defaultValue="0"
            required
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet"
          />
        </div>
        <div>
          <label htmlFor="warranty_months" className="mb-1.5 block text-xs font-medium text-text-secondary">Гарантія (міс)</label>
          <input
            id="warranty_months"
            name="warranty_months"
            type="number"
            min="0"
            defaultValue="3"
            required
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet"
          />
        </div>
      </div>

      <div className="border-t border-warm-border/50 pt-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Стан пристрою на момент здачі</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="device_condition" className="mb-1.5 block text-xs font-medium text-text-secondary">Грейд стану *</label>
            <select id="device_condition" name="device_condition" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet">
              <option value="">Оберіть стан...</option>
              <option value="new">Новий</option>
              <option value="A">Grade A (Ідеальний)</option>
              <option value="B">Grade B (Хороший)</option>
              <option value="C">Grade C (Середній)</option>
              <option value="for_repair">Під ремонт</option>
            </select>
          </div>
          <div>
            <label htmlFor="device_condition_description" className="mb-1.5 block text-xs font-medium text-text-secondary">Опис стану</label>
            <input id="device_condition_description" name="device_condition_description" placeholder="Подряпини, сколи, сліди використання..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Фото стану пристрою *</label>
          <p className="text-xs text-text-secondary mb-2">Додайте фото пристрою на момент приймання (обов'язково)</p>
          <input type="file" name="device_condition_photos" multiple accept="image/*" required className="w-full text-sm text-text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-violet file:px-3 file:py-2 file:text-xs file:font-medium file:text-white" />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-text-secondary">Примітки (опціонально)</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="Пароль від пристрою, стан, додаткові аксесуари..."
          className="w-full resize-none rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/40"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending ? <span className="animate-pulse opacity-60">Зачекайте...</span> : "Створити ремонт"}
      </button>
    </form>
  );
}
