"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createMultiSaleAction } from "@/lib/actions/sales";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";

import { Customer, CashRegister, Device, Accessory, Part, Service, LastSaleData } from "./pos-types";
import { DEFAULT_WARRANTY_TERM, warrantyWindow, type WarrantyTerm } from "./pos-warranty";
import { prefillFromOrder, type CheckoutOrder } from "./order-prefill";
import { usePOSCart } from "./usePOSCart";
import { usePOSCatalog } from "./usePOSCatalog";
import { POSCatalog } from "./POSCatalog";
import { POSCartSidebar } from "./POSCartSidebar";

export function POSClient({
  customers,
  devices,
  accessories,
  parts,
  services,
  order = null,
}: {
  customers: Customer[];
  cashRegisters: CashRegister[];
  devices: Device[];
  accessories: Accessory[];
  parts: Part[];
  services: Service[];
  /** Видача замовлення: кошик уже наповнений, аванс уже в касі. */
  order?: CheckoutOrder | null;
}) {
  const router = useRouter();

  /* Префіл рахується один раз, при першому рендері: далі кошик живе своїм
     життям — касир може прибрати позицію чи змінити ціну, і перерахунок із
     замовлення затер би ці правки. */
  const [prefill] = useState(() =>
    order ? prefillFromOrder(order, { devices, accessories, parts, services }) : null,
  );

  const {
    cart, setCart, discount, setDiscount, cartSubtotal, finalTotal,
    addToCart, updateQty, updatePrice, clearCart
  } = usePOSCart(prefill?.cart ?? []);

  const catalog = usePOSCatalog(devices, accessories, parts, services, cart);

  /* Аванс замовлення. Зараховує його сервер — він же й перевіряє суму по базі;
     тут це число живе лише для того, щоб касир бачив, скільки брати з клієнта.
     Аванс, більший за чек, не «згорає» до нуля: сервер такий чек відхилить, і
     сховати це від касира означало б показати «до сплати 0» там, де насправді
     треба повертати різницю. */
  const depositApplied = order?.deposit ?? 0;
  const amountDue = finalTotal - depositApplied;

  const [activeMobileTab, setActiveMobileTab] = useState<"catalog" | "cart">(
    order ? "cart" : "catalog",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(order?.customer_id ?? "");
  const [notes, setNotes] = useState<string>("");
  const [warrantyTerm, setWarrantyTerm] = useState<WarrantyTerm>(DEFAULT_WARRANTY_TERM);
  
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  
  const [promoCode, setPromoCode] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [linkDeviceToCustomer, setLinkDeviceToCustomer] = useState<boolean>(true);

  // New customer creation state
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [custError, setCustError] = useState("");
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  // Form Submitting Action state
  const [pending, setPending] = useState(false);
  const [successSaleId, setSuccessSaleId] = useState<string | null>(null);
  /* Окремо від `order`: після `router.refresh()` замовлення вже продане, тож
     серверний проп стає null — а вікно успіху ще на екрані. */
  const [completedOrderNo, setCompletedOrderNo] = useState<string | null>(null);
  const [lastSaleData, setLastSaleData] = useState<LastSaleData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [actionError, setActionError] = useState<string>("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCashAmount(Math.max(0, amountDue).toString());
    setCardAmount("0");
  }, [amountDue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCheckPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoMessage(null);
    const res = await validatePromoCode(promoCode.trim());
    if (res.success && res.partner) {
      setPartnerId(res.partner.id);
      setDiscount(res.partner.discount_percent);
      setPromoMessage({
        text: `Промокод успішний! Знижка ${res.partner.discount_percent}% від ${res.partner.name}`,
        type: "success"
      });
    } else {
      setPartnerId("");
      setPromoMessage({ text: res.error || "Недійсний промокод", type: "error" });
    }
  };

  const handleCreateCustomer = async () => {
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
      setDiscount(created.discount_percent || 0);
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustEmail("");
    } else {
      setCustError(res.error || "Помилка створення клієнта");
    }
  };

  const handleCustomerChange = (customerId: string) => {
    if (customerId === "__new__") {
      setShowNewCustomer(true);
      setSelectedCustomerId("");
      return;
    }
    setSelectedCustomerId(customerId);
    const cust = localCustomers.find(c => c.id === customerId);
    setDiscount(cust ? cust.discount_percent : 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setPending(true);
    setActionError("");

    const warranty = warrantyWindow(warrantyTerm);

    const payload = {
      customer_id: selectedCustomerId || null,
      discount,
      notes,
      warranty_start: warranty.start,
      warranty_end: warranty.end,
      is_split: isSplit,
      cash_amount: isSplit ? parseFloat(cashAmount) || 0 : 0,
      card_amount: isSplit ? parseFloat(cardAmount) || 0 : 0,
      method: paymentMethod,
      sale_type: "retail",
      delivery_needed: false,
      partner_id: partnerId || null,
      promo_code_used: promoCode.trim() || null,
      link_device_to_customer: linkDeviceToCustomer,
      order_id: order?.id ?? null,
      items: cart.map(c => ({
        item_type: c.item_type,
        item_id: c.id,
        item_name: c.name,
        quantity: c.quantity,
        unit_price: c.unit_price,
        unit_cost: c.unit_cost
      }))
    };

    const res = await createMultiSaleAction(null, payload);
    setPending(false);

    if (res.success && res.data) {
      setLastSaleData({
        id: res.data.saleId,
        created_at: new Date().toISOString(),
        customer_name: localCustomers.find(c => c.id === selectedCustomerId)?.name || "Роздрібний покупець (Гість)",
        customer_phone: localCustomers.find(c => c.id === selectedCustomerId)?.phone || "",
        seller_name: "Адміністратор",
        items: cart.map(c => ({
          name: c.name,
          quantity: c.quantity,
          unit_price: c.unit_price,
          total_price: c.unit_price * c.quantity,
          item_type: c.item_type
        })),
        total_amount: finalTotal,
        discount: discount,
        deposit: depositApplied,
        order_no: order?.order_no,
        register_name: "Основна каса",
        warranty_end: warranty.end
      });
      setSuccessSaleId(res.data.saleId);
      setCompletedOrderNo(order?.order_no ?? null);
      clearCart();
      setNotes("");
      setPromoCode("");
      setDiscount(0);
      router.refresh();
    } else {
      setActionError(res.error || "Помилка при проведенні продажу.");
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:gap-6 min-h-[calc(100vh-120px)] w-full">
      
      {/* Mobile tabs switcher */}
      <div className="flex lg:hidden bg-warm-sidebar rounded-xl p-1 border border-warm-border/50 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMobileTab("catalog")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
            activeMobileTab === "catalog"
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          🏪 Вітрина
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab("cart")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all relative ${
            activeMobileTab === "cart"
              ? "bg-surface text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          🛒 Кошик
          {cart.length > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet text-white text-[10px] font-bold px-1.5 animate-pulse">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full flex-1">
        {/* LEFT COLUMN: Shopping Cart Panel */}
        <POSCartSidebar
          activeMobileTab={activeMobileTab}
          cart={cart}
          cartSubtotal={cartSubtotal}
          discount={discount}
          finalTotal={finalTotal}
          order={order}
          orderUnmatched={prefill?.unmatched ?? []}
          depositApplied={depositApplied}
          amountDue={amountDue}
          updateQty={updateQty}
          updatePrice={updatePrice}
          showNewCustomer={showNewCustomer}
          setShowNewCustomer={setShowNewCustomer}
          newCustName={newCustName}
          setNewCustName={setNewCustName}
          newCustPhone={newCustPhone}
          setNewCustPhone={setNewCustPhone}
          newCustEmail={newCustEmail}
          setNewCustEmail={setNewCustEmail}
          custError={custError}
          handleCreateCustomer={handleCreateCustomer}
          selectedCustomerId={selectedCustomerId}
          handleCustomerChange={handleCustomerChange}
          localCustomers={localCustomers}
          isSplit={isSplit}
          setIsSplit={setIsSplit}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          cashAmount={cashAmount}
          setCashAmount={setCashAmount}
          cardAmount={cardAmount}
          setCardAmount={setCardAmount}
          actionError={actionError}
          pending={pending}
          handleCheckout={handleCheckout}
          linkDeviceToCustomer={linkDeviceToCustomer}
          setLinkDeviceToCustomer={setLinkDeviceToCustomer}
          notes={notes}
          setNotes={setNotes}
          warrantyTerm={warrantyTerm}
          setWarrantyTerm={setWarrantyTerm}
        />

        {/* RIGHT COLUMN: Bento Storefront Grid */}
        <POSCatalog
          activeMobileTab={activeMobileTab}
          activeCategory={catalog.activeCategory}
          setActiveCategory={catalog.setActiveCategory}
          activeAccessoryCategory={catalog.activeAccessoryCategory}
          setActiveAccessoryCategory={catalog.setActiveAccessoryCategory}
          searchQuery={catalog.searchQuery}
          setSearchQuery={catalog.setSearchQuery}
          filteredCatalogItems={catalog.filteredCatalogItems}
          addToCart={addToCart}
          inStockDevicesCount={catalog.inStockDevices.length}
          activeServicesCount={catalog.activeServices.length}
        />
      </div>

      {/* Success checkout Dialog overlay */}
      <AnimatePresence>
        {successSaleId && (
          <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4">
            <style>{`
              @keyframes draw-circle {
                to { stroke-dashoffset: 0; }
              }
              @keyframes draw-check {
                to { stroke-dashoffset: 0; }
              }
            `}</style>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-surface dark:bg-zinc-900 rounded-3xl max-w-md w-full p-7 text-center shadow-xl space-y-5 border border-warm-border dark:border-border-strong"
            >
              <div className="h-16 w-16 rounded-full bg-emerald/15 text-emerald mx-auto flex items-center justify-center relative overflow-hidden">
                <svg className="w-10 h-10 stroke-current stroke-[3.5] fill-none" viewBox="0 0 52 52">
                  <circle
                    className="stroke-emerald fill-none"
                    strokeWidth="3.5"
                    cx="26"
                    cy="26"
                    r="22"
                    strokeDasharray="140"
                    strokeDashoffset="140"
                    style={{
                      animation: "draw-circle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards"
                    }}
                  />
                  <path
                    className="stroke-emerald fill-none"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 27l8 8 16-16"
                    strokeDasharray="50"
                    strokeDashoffset="50"
                    style={{
                      animation: "draw-check 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards"
                    }}
                  />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-bold text-text-primary dark:text-white tracking-tight">
                  {completedOrderNo ? `Замовлення #${completedOrderNo} видано!` : "Продаж успішно проведено!"}
                </h3>
                <p className="text-xs text-text-secondary dark:text-faint mt-1.5 leading-relaxed">
                  {completedOrderNo
                    ? "Чек проведено на повну суму, аванс зараховано, замовлення закрито. Роздрукуйте чек для клієнта."
                    : "Транзакцію успішно записано. Виберіть подальшу дію або роздрукуйте чек для клієнта."}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessSaleId(null);
                    /* `?order=` уже відпрацював. Лишити його в адресі означало б
                       наступний продаж під заголовком чужого замовлення. */
                    if (completedOrderNo) router.replace("/admin/sales/pos");
                  }}
                  className="flex-1 btn-press py-3 px-4 border border-warm-border/80 bg-warm-surface text-text-secondary dark:bg-zinc-800 dark:border-border-strong dark:text-zinc-200 dark:hover:bg-zinc-700 hover:bg-iris/5 text-xs font-semibold rounded-xl cursor-pointer transition-colors active:scale-[0.98]"
                >
                  Новий продаж
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="flex-1 btn-press py-3 px-4 bg-emerald hover:bg-emerald/90 text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald/10 active:scale-[0.98]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span>Друкувати чек</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSuccessSaleId(null);
                  router.push("/admin/sales");
                }}
                className="w-full text-xs font-medium text-text-secondary/60 dark:text-faint hover:text-violet hover:underline pt-1 cursor-pointer transition-colors"
              >
                Перейти до списку всіх продажів →
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WYSIWYG Print Modal */}
      {lastSaleData && (
        <ReceiptPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          type="sale"
          data={lastSaleData}
        />
      )}

    </div>
  );
}
