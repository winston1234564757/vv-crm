"use client";

import { useActionState, useEffect, useState } from "react";
import { createRepair, searchCompletedRepairs } from "@/lib/actions/repairs";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import SearchSelect from "@/components/ui/SearchSelect";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import { IconEye, IconEyeOff } from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string | null;
}

interface Device {
  id: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  status: string;
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

export function RepairForm({ 
  customers, 
  devices, 
  onSuccess,
  initialDeviceId = "",
  initialIsInternal = false
}: { 
  customers: Customer[], 
  devices: Device[], 
  onSuccess: () => void,
  initialDeviceId?: string,
  initialIsInternal?: boolean
}) {
  const initialState: { success: boolean; error: string; data?: any } = { success: false, error: "" };
  const [state, formAction, pending] = useActionState(action, initialState);




  const [custError, setCustError] = useState("");
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  const [isInternal, setIsInternal] = useState(initialIsInternal);
  const [isWarranty, setIsWarranty] = useState(false);

  const [pastRepairs, setPastRepairs] = useState<any[]>([]);
  const [selectedPastRepairId, setSelectedPastRepairId] = useState("");
  const [pastRepairsLoading, setPastRepairsLoading] = useState(false);
  const [pastRepairsSearch, setPastRepairsSearch] = useState("");

  const [selectedInventoryDeviceId, setSelectedInventoryDeviceId] = useState(initialDeviceId);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const initialDev = initialDeviceId ? devices.find(d => d.id === initialDeviceId) : null;
  const [deviceName, setDeviceName] = useState(initialDev ? `${initialDev.brand ?? ""} ${initialDev.model ?? ""}`.trim() : "");
  const [deviceImei, setDeviceImei] = useState(initialDev ? (initialDev.imei ?? "") : "");

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<string[]>([]);

  const [createdData, setCreatedData] = useState<{id: string, tracking_token: string, issue: string, price: number} | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);


  useEffect(() => {
    if (isWarranty) {
      const fetchPastRepairs = async () => {
        setPastRepairsLoading(true);
        const data = await searchCompletedRepairs(selectedCustomerId || null, pastRepairsSearch);
        setPastRepairs(data);
        setPastRepairsLoading(false);
      };
      
      const timeoutId = setTimeout(() => {
        fetchPastRepairs();
      }, 500); // debounce
      return () => clearTimeout(timeoutId);
    }
  }, [isWarranty, selectedCustomerId, pastRepairsSearch]);

  const handleSelectPastRepair = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rId = e.target.value;
    setSelectedPastRepairId(rId);
    if (rId) {
      const r = pastRepairs.find(x => x.id === rId);
      if (r) {
        setDeviceName(r.device_name || "");
        setDeviceImei(r.device_imei || "");
        if (!selectedCustomerId && r.customer?.id) {
          setSelectedCustomerId(r.customer.id);
        }
      }
    }
  };

  useEffect(() => {
    if (state.success && state.data?.id) {
      setCreatedData(state.data as any);
    }
  }, [state.success, state.data]);

  if (createdData) {
    const customer = localCustomers.find((c) => c.id === selectedCustomerId);
    
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center space-y-6 animate-entry">
        {/* Animated Checkmark Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/10 text-emerald animate-bounce">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-text-primary">Ремонт успішно створено!</h2>
          <p className="text-xs text-text-secondary mt-1">Пристрій прийнято в роботу</p>
        </div>

        {/* Short Breakdown */}
        <div className="w-full rounded-2xl bg-warm-bg border border-warm-border p-4 text-left space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-secondary">Клієнт:</span>
            <span className="font-medium text-text-primary">{customer?.name || "Внутрішній ремонт"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Пристрій:</span>
            <span className="font-medium text-text-primary truncate max-w-[200px] text-right">{deviceName || "Невідомий"}</span>
          </div>
          <div className="flex justify-between border-t border-warm-border/50 pt-2 text-sm">
            <span className="font-semibold text-text-primary">Код відстеження:</span>
            <span className="font-mono font-bold text-violet tracking-widest">{createdData.tracking_token}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-hover cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Роздрукувати квитанцію</span>
          </button>
          
          <button
            type="button"
            onClick={onSuccess}
            className="btn-press w-full rounded-xl bg-white border border-warm-border hover:bg-warm-hover py-3 text-sm font-medium text-text-primary transition-colors cursor-pointer"
          >
            Закрити вікно
          </button>
        </div>

        <ReceiptPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          type="repair_acceptance"
          data={{
            id: createdData.id,
            customer_name: customer?.name || "Клієнт",
            customer_phone: customer?.phone || "",
            seller_name: "Адміністратор",
            device_name: deviceName,
            device_imei: deviceImei,
            tracking_token: createdData.tracking_token,
            issue: createdData.issue || "Не вказано",
            price: createdData.price || 0
          }}
        />
      </div>
    );
  }

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

  function handleDeviceSelect(id: string) {
    setSelectedInventoryDeviceId(id);
    const dev = devices.find(d => d.id === id);
    if (dev) {
      setDeviceName(`${dev.brand ?? ""} ${dev.model ?? ""}`.trim());
      setDeviceImei(dev.imei ?? "");
    } else {
      setDeviceName("");
      setDeviceImei("");
    }
  }

  async function action(prevState: typeof initialState, formData: FormData) {
    formData.set("issue_nodes", JSON.stringify(selectedNodes));
    formData.set("issue_diagnostics", JSON.stringify(selectedDiagnostics));
    
    // Передаємо назву та IMEI зі стейту (оскільки при disabled вони не надсилаються автоматично)
    formData.set("device_name", deviceName);
    formData.set("device_imei", deviceImei);

    if (isInternal) {
      formData.set("customer_id", "");
      formData.set("inventory_device_id", selectedInventoryDeviceId);
    } else {
      formData.set("customer_id", selectedCustomerId);
      formData.set("inventory_device_id", "");
    }

    if (partnerId) {
      formData.set("partner_id", partnerId);
      formData.set("promo_code_used", promoCode.trim());
    }
    const res = await createRepair(null, formData);
    if (res.success) return { success: true, error: "", data: res.data };
    return { success: false, error: res.error || "Сталася помилка" };
  }

  const selectOptions = [
    ...localCustomers.map(c => ({ id: c.id, label: `${c.name} (${c.phone})` })),
    { id: "__new__", label: "+ Новий клієнт" }
  ];

  const deviceOptions = devices.map(d => ({
    id: d.id,
    label: `${d.brand ?? ""} ${d.model ?? ""} (IMEI: ${d.imei ?? "не вказано"})`
  }));

  return (
    <form action={formAction} className="flex flex-col gap-5 p-5">
      {(state.error || custError) && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error || custError}
        </div>
      )}

      {/* Перемикач типу ремонту */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-secondary">Тип ремонту</label>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-iris/5 p-1 border border-iris/10">
          <button
            type="button"
            onClick={() => {
              setIsInternal(false);
              setSelectedInventoryDeviceId("");
              setDeviceName("");
              setDeviceImei("");
            }}
            className={`rounded-lg py-2.5 text-xs font-semibold tracking-wide transition-all ${
              !isInternal
                ? "bg-violet text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            👤 Клієнтський ремонт
          </button>
          <button
            type="button"
            onClick={() => {
              setIsInternal(true);
              setSelectedCustomerId("");
            }}
            className={`rounded-lg py-2.5 text-xs font-semibold tracking-wide transition-all ${
              isInternal
                ? "bg-violet text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            📦 Внутрішній (Склад)
          </button>
        </div>
      </div>

      {!isInternal ? (
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
              <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Ім&apos;я *" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
              <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="Телефон *" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
              <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="Email (опціонально)" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
              <button type="button" onClick={handleCreateCustomer} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
                Створити клієнта
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <SearchSelect
            label="Складський пристрій на продаж"
            name="inventory_device_id"
            options={deviceOptions}
            value={selectedInventoryDeviceId}
            onChange={handleDeviceSelect}
            placeholder="Оберіть пристрій зі складу..."
            required
          />
        </div>
      )}

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
          value={deviceName}
          onChange={e => setDeviceName(e.target.value)}
          disabled={isInternal}
          placeholder={isInternal ? "Оберіть пристрій вище" : "Напр. iPhone 13 Pro Max"}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/40 disabled:opacity-60 disabled:bg-iris/5"
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
              placeholder="Код блокування..."
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
          <label htmlFor="device_accessories_included" className="mb-1.5 block text-xs font-medium text-text-secondary">Комплектація (що здано)</label>
          <input id="device_accessories_included" name="device_accessories_included" type="text" placeholder="Зарядка, чохол, коробка..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
        </div>
      </div>

      <div>
        <label htmlFor="device_imei" className="mb-1.5 block text-xs font-medium text-text-secondary">IMEI / Серійний номер (опціонально)</label>
        <input
          id="device_imei"
          name="device_imei"
          type="text"
          value={deviceImei}
          onChange={e => setDeviceImei(e.target.value)}
          disabled={isInternal}
          placeholder="IMEI або S/N"
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/40 disabled:opacity-60 disabled:bg-iris/5"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="source" className="mb-1.5 block text-xs font-medium text-text-secondary">Звідки звернувся</label>
          <select id="source" name="source" value={source} onChange={(e) => setSource(e.target.value)} required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet">
            <option value="walk_in">Прийшов у магазин</option>
            <option value="phone">Зателефонував</option>
            <option value="online">Онлайн (сайт/месенджер)</option>
            {!isInternal && <option value="marketplace">Маркетплейс / Промокод</option>}
          </select>
          {!isInternal && source === "marketplace" && (
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
        <label htmlFor="issue" className="mb-1.5 block text-xs font-medium text-text-secondary">Опис проблеми / роботи</label>
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
            value={isWarranty ? 0 : undefined}
            defaultValue={isWarranty ? undefined : "0"}
            disabled={isWarranty}
            required={!isWarranty}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet disabled:opacity-60 disabled:bg-iris/5"
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

      <label className="flex items-center gap-3 cursor-pointer bg-violet/5 hover:bg-violet/10 px-4 py-3 rounded-xl transition-colors border border-violet/10 group mt-2 mb-2">
        <div className="relative flex items-center justify-center">
          <input type="checkbox" name="is_warranty" value="true" checked={isWarranty} onChange={e => setIsWarranty(e.target.checked)} className="peer w-5 h-5 rounded border-violet/30 text-violet focus:ring-violet focus:ring-offset-0 bg-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-violet">🛡️ Це гарантійний випадок</span>
          <span className="text-[11px] text-text-secondary opacity-80">Вартість ремонту буде 0 грн</span>
        </div>
      </label>

      {isWarranty && (
        <div className="mb-4 bg-violet/5 border border-violet/20 rounded-xl p-4 animate-entry">
          <label className="block text-xs font-semibold text-violet mb-2">
            {selectedCustomerId ? "Оберіть попередній ремонт цього клієнта" : "Знайдіть попередній ремонт (Глобально)"}
          </label>
          
          {!selectedCustomerId && (
            <input 
              type="text" 
              placeholder="Пошук за моделлю, IMEI або проблемою..."
              value={pastRepairsSearch}
              onChange={(e) => setPastRepairsSearch(e.target.value)}
              className="w-full mb-3 rounded-xl border border-violet/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet focus:ring-1 focus:ring-violet placeholder:text-text-secondary/50"
            />
          )}

          {pastRepairsLoading ? (
             <div className="text-xs text-text-secondary flex items-center gap-2">Завантаження ремонтів...</div>
          ) : (
            <select 
              value={selectedPastRepairId}
              onChange={handleSelectPastRepair}
              className="w-full rounded-xl border border-violet/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet focus:ring-1 focus:ring-violet"
            >
              <option value="">-- Оберіть ремонт для гарантії --</option>
              {pastRepairs.map((pr: any) => (
                <option key={pr.id} value={pr.id}>
                  {pr.device_name} (Ремонт від {new Date(pr.completed_at || pr.created_at || "").toLocaleDateString()}) - {pr.issue.substring(0, 30)}
                </option>
              ))}
            </select>
          )}
          
          <input type="hidden" name="warranty_for_repair_id" value={selectedPastRepairId} />
        </div>
      )}



      <div className="border-t border-warm-border/50 pt-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Стан пристрою на момент здачі</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="device_condition" className="mb-1.5 block text-xs font-medium text-text-secondary">Грейд стану *</label>
            <select id="device_condition" name="device_condition" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet">
              <option value="">Оберіть стан...</option>
              <option value="perfect">Grade A (Ідеальний / Новий)</option>
              <option value="good">Grade B (Хороший)</option>
              <option value="fair">Grade C (Середній)</option>
              <option value="poor">Поганий</option>
              <option value="damaged">Під ремонт / Пошкоджений</option>
            </select>
          </div>
          <div>
            <label htmlFor="device_condition_description" className="mb-1.5 block text-xs font-medium text-text-secondary">Опис стану</label>
            <input id="device_condition_description" name="device_condition_description" placeholder="Подряпини, сколи, сліди використання..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Фото стану пристрою *</label>
          <p className="text-xs text-text-secondary mb-2">Додайте фото пристрою на момент приймання (обов&apos;язково)</p>
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
