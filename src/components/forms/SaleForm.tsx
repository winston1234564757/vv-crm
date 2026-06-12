"use client";

import { useActionState, useEffect, useState } from "react";
import { createQuickSale } from "@/lib/actions/sales";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import SearchSelect from "@/components/ui/SearchSelect";
import { calculateDiscountedPrice, calculateRemainingSplit } from "@/lib/utils/finance";
import { validateDiscount, validateSplitPayment } from "@/lib/utils/finance";

interface Customer { id: string; name: string; phone: string; discount_percent: number; }
interface CashRegister { id: string; name: string; }
interface Device { id: string; brand: string | null; model: string | null; imei: string | null; price: number; status: string; }
interface Accessory { id: string; name: string; sku: string | null; price: number; stock: number; status: string; }
interface Service { id: string; name: string; price: number; status: string; }

export function SaleForm({
  customers,
  cashRegisters,
  devices,
  accessories,
  services,
  initialCategory,
  initialItemId,
  onSuccess
}: {
  customers: Customer[];
  cashRegisters: CashRegister[];
  devices: Device[];
  accessories: Accessory[];
  services?: Service[];
  initialCategory?: "device" | "accessory" | "service";
  initialItemId?: string;
  onSuccess: () => void
}) {
  const initialState = { success: false, error: "" };
  const [state, formAction, pending] = useActionState(action, initialState);
  const [custError, setCustError] = useState("");
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  useEffect(() => { if (state.success) onSuccess(); }, [state.success, onSuccess]);

  const [category, setCategory] = useState<"device" | "accessory" | "service">(initialCategory ?? "accessory");
  const [itemId, setItemId] = useState<string>(initialItemId ?? "");
  const [amount, setAmount] = useState<string>("");

  const [discount, setDiscount] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");

  const updatePriceFromSelection = (itemId: string, category: "device" | "accessory" | "service") => {
    let price = 0;
    if (category === "device") {
      const d = devices.find(x => x.id === itemId);
      if (d) price = d.price;
    } else if (category === "accessory") {
      const a = accessories.find(x => x.id === itemId);
      if (a) price = a.price;
    } else if (category === "service" && services) {
      const s = services.find(x => x.id === itemId);
      if (s) price = s.price;
    }
    setBasePrice(price);
  };

  useEffect(() => {
    if (initialItemId && initialCategory) {
      updatePriceFromSelection(initialItemId, initialCategory);
    }
  }, [initialItemId, initialCategory, devices, accessories, services]);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const inStockDevices = devices.filter(d => d.status === "in_stock");
  const activeAccessories = accessories.filter(a => a.status === "active" && a.stock > 0);
  const activeServices = (services ?? []).filter(s => s.status === "active");

  const [promoCode, setPromoCode] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [promoMessage, setPromoMessage] = useState<{text: string, type: "success" | "error"} | null>(null);

  async function handleCheckPromo() {
    if (!promoCode.trim()) return;
    setPromoMessage(null);
    const res = await validatePromoCode(promoCode.trim());
    if (res.success && res.partner) {
      setPartnerId(res.partner.id);
      setDiscount(res.partner.discount_percent);
      const finalAmount = calculateDiscountedPrice(basePrice, res.partner.discount_percent);
      setAmount(finalAmount.toString());
      setCashAmount(finalAmount.toString());
      setCardAmount("0");
      setPromoMessage({ text: `Партнер: ${res.partner.name}. Знижка ${res.partner.discount_percent}%!`, type: "success" });
    } else {
      setPartnerId("");
      setDiscount(0);
      setAmount(basePrice.toString());
      setCashAmount(basePrice.toString());
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
      
      // Apply discount if any
      const pct = created.discount_percent || 0;
      setDiscount(pct);
      const finalAmount = calculateDiscountedPrice(basePrice, pct);
      setAmount(finalAmount.toString());
      setCashAmount(finalAmount.toString());
      setCardAmount("0");
      
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
    } else {
      setCustError(res.error || "Помилка створення клієнта");
    }
  }

  async function action(prevState: typeof initialState, formData: FormData) {
    formData.set("item_id", itemId);
    formData.set("customer_id", selectedCustomerId);
    formData.set("discount", discount.toString());
    formData.set("is_split", isSplit ? "true" : "false");
    if (isSplit) {
      formData.set("cash_amount", cashAmount);
      formData.set("card_amount", cardAmount);
    }
    if (partnerId) {
      formData.set("partner_id", partnerId);
      formData.set("promo_code_used", promoCode.trim());
    }
    const res = await createQuickSale(null, formData);
    if (res.success) return { success: true, error: "" };
    return { success: false, error: res.error || "Сталася помилка" };
  }

  function handleCategoryChange(cat: "device" | "accessory" | "service") {
    setCategory(cat);
    setItemId("");
    setBasePrice(0);
    setAmount("");
    setDiscount(0);
    setCashAmount("");
    setCardAmount("");
  }

  function handleItemSelect(id: string) {
    setItemId(id);
    let price = 0;
    if (category === "device") {
      const d = inStockDevices.find(x => x.id === id);
      if (d) price = d.price;
    } else if (category === "accessory") {
      const a = activeAccessories.find(x => x.id === id);
      if (a) price = a.price;
    } else if (category === "service") {
      const s = activeServices.find(x => x.id === id);
      if (s) price = s.price;
    }
    setBasePrice(price);
    const finalAmount = calculateDiscountedPrice(price, discount);
    setAmount(finalAmount.toString());
    setCashAmount(finalAmount.toString());
    setCardAmount("0");
  }

  function handleCustomerSelect(id: string) {
    if (id === "__new__") {
      setShowNewCustomer(true);
      setSelectedCustomerId("");
      return;
    }
    setShowNewCustomer(false);
    setSelectedCustomerId(id);
    const customer = localCustomers.find(c => c.id === id);
    const pct = customer ? customer.discount_percent : 0;
    setDiscount(pct);

    const finalAmount = calculateDiscountedPrice(basePrice, pct);
    setAmount(finalAmount.toString());
    setCashAmount(finalAmount.toString());
    setCardAmount("0");
  }

  function handleAmountChange(val: string) {
    setAmount(val);
    const num = parseFloat(val) || 0;
    setCashAmount(num.toString());
    setCardAmount("0");
  }

  function handleCashAmountChange(val: string) {
    setCashAmount(val);
    const total = parseFloat(amount) || 0;
    const cash = parseFloat(val) || 0;
    setCardAmount(Math.max(0, total - cash).toString());
  }

  function handleCardAmountChange(val: string) {
    setCardAmount(val);
    const total = parseFloat(amount) || 0;
    const card = parseFloat(val) || 0;
    setCashAmount(Math.max(0, total - card).toString());
  }

  const getAutoRegisterName = () => {
    if (category === "accessory") return "Каса аксесуарів";
    if (category === "service") return "Каса ремонтів";
    return "Каса техніки";
  };

  // Split calculations
  const totalAmountVal = parseFloat(amount) || 0;
  const cashAmountVal = parseFloat(cashAmount) || 0;
  const cardAmountVal = parseFloat(cardAmount) || 0;
  const remainingSplit = calculateRemainingSplit(totalAmountVal, cashAmountVal, cardAmountVal);

  return (
    <form action={formAction} className="flex flex-col gap-5 p-5">

      {(state.error || custError) && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">
          {state.error || custError}
        </div>
      )}

      <div className="flex gap-2 p-1 bg-iris/5 rounded-xl border border-iris/10">
        <label className={`flex-1 text-center py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${category === "accessory" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
          <input type="radio" name="item_category" value="accessory" checked={category === "accessory"} onChange={() => handleCategoryChange("accessory")} className="hidden" />
          Аксесуар
        </label>
        <label className={`flex-1 text-center py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${category === "device" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
          <input type="radio" name="item_category" value="device" checked={category === "device"} onChange={() => handleCategoryChange("device")} className="hidden" />
          Техніка
        </label>
        <label className={`flex-1 text-center py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${category === "service" ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}>
          <input type="radio" name="item_category" value="service" checked={category === "service"} onChange={() => handleCategoryChange("service")} className="hidden" />
          Послуга
        </label>
      </div>

      {category === "accessory" && (
        <SearchSelect
          label="Виберіть аксесуар"
          name="item_id"
          options={activeAccessories.map(a => ({ id: a.id, label: `${a.name} (${a.price} грн)`, subLabel: `Залишок: ${a.stock} шт` }))}
          value={itemId}
          onChange={handleItemSelect}
          placeholder="Оберіть зі списку..."
          required
        />
      )}

      {category === "device" && (
        <SearchSelect
          label="Виберіть техніку"
          name="item_id"
          options={inStockDevices.map(d => ({ id: d.id, label: `${d.brand} ${d.model} (${d.price} грн)`, subLabel: d.imei ? `IMEI: ${d.imei}` : undefined }))}
          value={itemId}
          onChange={handleItemSelect}
          placeholder="Оберіть зі списку..."
          required
        />
      )}

      {category === "service" && (
        <div className="space-y-4">
          <SearchSelect
            label="Виберіть послугу"
            name="item_id"
            options={[
              ...activeServices.map(s => ({ id: s.id, label: `${s.name} (${s.price} грн)` })),
              { id: "__custom__", label: "Інша послуга (ввести вручну)" }
            ]}
            value={itemId}
            onChange={handleItemSelect}
            placeholder="Оберіть зі списку..."
            required
          />
          {itemId === "__custom__" && (
            <div className="animate-entry">
              <label htmlFor="item_name" className="mb-1.5 block text-xs font-medium text-text-secondary">Введіть назву вручну</label>
              <input id="item_name" name="item_name" type="text" placeholder="Напр. Поклейка скла..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" required />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="sale_type" className="mb-1.5 block text-xs font-medium text-text-secondary">Тип продажу</label>
          <select id="sale_type" name="sale_type" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet cursor-pointer">
            <option value="retail">Роздріб</option>
            <option value="online">Онлайн</option>
          </select>
        </div>
        <div>
          <label htmlFor="monobank_payment_id" className="mb-1.5 block text-xs font-medium text-text-secondary">ID транзакції Monobank</label>
          <input id="monobank_payment_id" name="monobank_payment_id" type="text" placeholder="якщо оплата карткою" className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
        </div>
      </div>

      <div>
        <SearchSelect
          label="Клієнт (опціонально)"
          name="customer_id"
          options={[
            { id: "", label: "Не вказати" },
            ...localCustomers.map(c => ({
              id: c.id,
              label: `${c.name} (${c.phone})`,
              subLabel: c.discount_percent > 0 ? `Знижка ${c.discount_percent}%` : undefined
            })),
            { id: "__new__", label: "+ Новий клієнт" }
          ]}
          value={selectedCustomerId}
          onChange={handleCustomerSelect}
          placeholder="Не вказано"
        />
        {showNewCustomer && (
          <div className="mt-3 rounded-xl border border-violet/20 bg-violet/5 p-4 space-y-3">
            <p className="text-xs font-medium text-text-secondary">Новий клієнт</p>
            <input value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Ім\'я *" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            <input value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="Телефон *" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            <input value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="Email (опціонально)" className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            <button type="button" onClick={handleCreateCustomer} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
              Створити клієнта
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-violet/20 bg-violet/5 p-4 space-y-2">
        <label className="block text-xs font-medium text-violet">Промокод партнера (опціонально)</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={promoCode} 
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="VVC-XXXX"
            className="flex-1 rounded-lg border border-iris/20 bg-white px-3 py-2 text-sm uppercase font-mono outline-none focus:border-violet" 
          />
          <button type="button" onClick={handleCheckPromo} className="rounded-lg bg-violet px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-hover">
            Застосувати
          </button>
        </div>
        {promoMessage && (
          <p className={`text-xs font-medium ${promoMessage.type === "success" ? "text-emerald" : "text-rose"}`}>
            {promoMessage.text}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Сума до оплати (грн) {discount > 0 && <span className="text-cyan font-semibold">(-{discount}%)</span>}
          </label>
          <input id="amount" name="amount" type="number" min="0" required value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0" className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
        </div>
        {!isSplit && (
          <div>
            <label htmlFor="method" className="mb-1.5 block text-xs font-medium text-text-secondary">Спосіб оплати</label>
            <select id="method" name="method" required className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet cursor-pointer">
              <option value="cash">Готівка</option>
              <option value="card">Картка (термінал)</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 py-1">
        <input
          id="is_split_toggle"
          type="checkbox"
          checked={isSplit}
          onChange={(e) => {
            setIsSplit(e.target.checked);
            setCashAmount(amount);
            setCardAmount("0");
          }}
          className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer"
        />
        <label htmlFor="is_split_toggle" className="text-sm font-medium text-text-primary cursor-pointer">
          Розділити оплату (Готівка + Карта)
        </label>
      </div>

      {isSplit && (
        <div className="space-y-3 p-4 rounded-xl bg-violet/5 border border-violet/10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cash_amount" className="mb-1.5 block text-xs font-medium text-text-secondary">Готівка (грн)</label>
              <input id="cash_amount" type="number" min="0" max={amount} value={cashAmount} onChange={(e) => handleCashAmountChange(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            </div>
            <div>
              <label htmlFor="card_amount" className="mb-1.5 block text-xs font-medium text-text-secondary">Картка (грн)</label>
              <input id="card_amount" type="number" min="0" max={amount} value={cardAmount} onChange={(e) => handleCardAmountChange(e.target.value)} className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" />
            </div>
          </div>
          <div className="flex justify-between items-center text-xs mt-1.5 px-1">
            <span>Статус спліт-оплати:</span>
            {remainingSplit === 0 ? (
              <span className="text-emerald font-semibold flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Розраховано повністю</span>
              </span>
            ) : (
              <span id="split-payment-error" className="text-rose font-medium">
                {remainingSplit > 0 
                  ? `Залишилось розподілити: ${remainingSplit} грн` 
                  : `Перевищення ліміту на: ${Math.abs(remainingSplit)} грн`}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-iris/5 border border-iris/10 px-4 py-3 text-xs text-text-secondary flex items-center justify-between">
        <span>Каса зарахування:</span>
        <span className="font-semibold text-text-primary">{getAutoRegisterName()}</span>
      </div>

      <div className="border-t border-warm-border/50 pt-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">Доставка</h3>
        <div className="flex items-center gap-2">
          <input id="delivery_needed" name="delivery_needed" type="checkbox" value="true" className="h-5 w-5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer" />
          <label htmlFor="delivery_needed" className="text-sm font-medium text-text-primary cursor-pointer">Потрібна доставка</label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="delivery_address" className="mb-1.5 block text-xs font-medium text-text-secondary">Адреса доставки</label>
            <input id="delivery_address" name="delivery_address" type="text" placeholder="Місто, відділення НП..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
          </div>
          <div>
            <label htmlFor="delivery_tracking" className="mb-1.5 block text-xs font-medium text-text-secondary">ТТН доставки</label>
            <input id="delivery_tracking" name="delivery_tracking" type="text" placeholder="номер ТТН" className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet" />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-text-secondary">Коментар</label>
        <textarea id="notes" name="notes" placeholder="Нотатки до продажу..." className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet" rows={2} />
      </div>

      <button 
        type="submit" 
        disabled={pending || (isSplit && remainingSplit !== 0)} 
        aria-invalid={isSplit && remainingSplit !== 0 ? "true" : "false"}
        aria-describedby={isSplit && remainingSplit !== 0 ? "split-payment-error" : undefined}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 btn-press cursor-pointer disabled:cursor-not-allowed"
      >
        {pending ? <span className="animate-pulse opacity-60">Зачекайте...</span> : "Провести продаж"}
      </button>
    </form>
  );
}