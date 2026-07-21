import { motion, AnimatePresence } from "framer-motion";
import { IconDelete, IconSpinner } from "@/components/icons";
import { Customer, CartItem } from "./pos-types";

interface POSCartSidebarProps {
  activeMobileTab: "catalog" | "cart";
  cart: CartItem[];
  cartSubtotal: number;
  discount: number;
  finalTotal: number;
  updateQty: (id: string, type: string, delta: number) => void;
  updatePrice: (id: string, type: string, priceStr: string) => void;
  
  showNewCustomer: boolean;
  setShowNewCustomer: (val: boolean) => void;
  newCustName: string;
  setNewCustName: (val: string) => void;
  newCustPhone: string;
  setNewCustPhone: (val: string) => void;
  newCustEmail: string;
  setNewCustEmail: (val: string) => void;
  custError: string;
  handleCreateCustomer: () => void;
  
  selectedCustomerId: string;
  handleCustomerChange: (id: string) => void;
  localCustomers: Customer[];
  
  isSplit: boolean;
  setIsSplit: (val: boolean) => void;
  paymentMethod: "cash" | "card" | "transfer";
  setPaymentMethod: (val: "cash" | "card" | "transfer") => void;
  cashAmount: string;
  setCashAmount: (val: string) => void;
  cardAmount: string;
  setCardAmount: (val: string) => void;
  
  actionError: string;
  pending: boolean;
  handleCheckout: (e: React.FormEvent) => void;
  
  linkDeviceToCustomer: boolean;
  setLinkDeviceToCustomer: (val: boolean) => void;
  notes: string;
  setNotes: (val: string) => void;
}

export function POSCartSidebar({
  activeMobileTab,
  cart,
  cartSubtotal,
  discount,
  finalTotal,
  updateQty,
  updatePrice,
  showNewCustomer,
  setShowNewCustomer,
  newCustName,
  setNewCustName,
  newCustPhone,
  setNewCustPhone,
  newCustEmail,
  setNewCustEmail,
  custError,
  handleCreateCustomer,
  selectedCustomerId,
  handleCustomerChange,
  localCustomers,
  isSplit,
  setIsSplit,
  paymentMethod,
  setPaymentMethod,
  cashAmount,
  setCashAmount,
  cardAmount,
  setCardAmount,
  actionError,
  pending,
  handleCheckout,
  linkDeviceToCustomer,
  setLinkDeviceToCustomer,
  notes,
  setNotes
}: POSCartSidebarProps) {
  return (
    <div className={`${activeMobileTab === "cart" ? "flex" : "hidden lg:flex"} w-full lg:w-[42%] flex-col justify-between rounded-xl p-5 bg-surface shadow-[0_1px_3px_oklch(0%_0_0_/_0.06)] border border-warm-border max-h-[85vh] overflow-y-auto`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-iris/10 pb-3">
          <h2 className="text-base font-semibold text-text-primary text-balance tracking-tight">Кошик замовлення</h2>
          <span className="text-[11px] font-bold text-violet bg-violet/10 px-2.5 py-0.5 rounded-full">
            {cart.length} поз.
          </span>
        </div>

        {/* Client select */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">Клієнт</label>
          {showNewCustomer ? (
            <div className="p-3.5 rounded-xl border border-violet/20 bg-violet/5 space-y-2.5">
              <p className="text-xs font-semibold text-text-primary">Новий клієнт</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Ім'я"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  className="w-full rounded-lg border border-iris/20 bg-surface px-2.5 py-1.5 outline-none focus:border-violet"
                />
                <input
                  type="text"
                  placeholder="Телефон"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  className="w-full rounded-lg border border-iris/20 bg-surface px-2.5 py-1.5 outline-none focus:border-violet"
                />
              </div>
              {custError && <p className="text-[10px] text-rose font-medium">{custError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(false)}
                  className="btn px-2.5 py-1 text-[10px] bg-warm-surface border border-warm-border text-text-secondary"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  className="btn px-3 py-1 text-[10px] bg-violet text-white"
                >
                  Створити
                </button>
              </div>
            </div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={e => handleCustomerChange(e.target.value)}
              className="w-full rounded-xl border border-iris/20 bg-surface px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
            >
              <option value="">Роздрібний покупець (Гість)</option>
              <option value="__new__">+ Новий клієнт...</option>
              {localCustomers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) {c.discount_percent > 0 ? `[-${c.discount_percent}%]` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cart items list */}
        <div className="max-h-[30vh] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {cart.length === 0 ? (
              <motion.div
                key="empty-cart"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <p className="text-xs text-text-secondary/50 italic">Кошик порожній.</p>
                <p className="text-[10px] text-text-secondary/40 mt-1">Оберіть товари на вітрині праворуч</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => {
                  const itemTotal = item.unit_price * item.quantity;
                  const isUnderCost = item.unit_price < item.unit_cost;
                  return (
                    <motion.div
                      key={`${item.id}-${item.item_type}`}
                      initial={{ opacity: 0, height: 0, y: 12 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -12 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`flex items-center justify-between p-3 rounded-xl bg-surface border transition-all duration-200 overflow-hidden ${
                        isUnderCost ? "border-amber/40 bg-amber/[0.02] hover:border-amber/65" : "border-warm-border/60 hover:border-violet/25"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.item_type === "device" ? "bg-cyan/15 text-cyan" :
                            item.item_type === "accessory" ? "bg-violet/15 text-violet" :
                            item.item_type === "part" ? "bg-amber/15 text-amber" : "bg-emerald/15 text-emerald"
                          }`}>
                        {item.item_type === "device" ? "Девайс" :
                         item.item_type === "accessory" ? "Аксесуар" :
                         item.item_type === "part" ? "Деталь" : "Послуга"}
                      </span>
                      <span className="text-xs font-semibold text-text-primary truncate block max-w-[140px]">{item.name}</span>
                    </div>
                    {item.imei && <p className="text-[9px] text-text-secondary font-mono mt-0.5">IMEI: {item.imei}</p>}
                    {item.sku && <p className="text-[9px] text-text-secondary mt-0.5">SKU: {item.sku}</p>}
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Price editor */}
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] text-text-secondary flex justify-end gap-1">
                        <span>Собівартість:</span>
                        <span className="font-semibold font-mono">{item.unit_cost} ₴</span>
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updatePrice(item.id, item.item_type, e.target.value)}
                          className={`w-16 rounded border text-right px-1.5 py-0.5 text-xs outline-none ${
                            isUnderCost ? "border-amber text-amber font-semibold bg-amber/5" : "border-warm-border text-text-primary focus:border-violet"
                          }`}
                        />
                        <span className="text-xs text-text-secondary">₴</span>
                      </div>
                    </div>

                    {/* Qty editor */}
                    {item.item_type !== "device" ? (
                      <div className="flex items-center border border-warm-border rounded-lg bg-warm-surface overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.item_type, -1)}
                          className="px-2 py-1 text-xs font-bold hover:bg-iris/10"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-medium text-text-primary">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.item_type, 1)}
                          className="px-2 py-1 text-xs font-bold hover:bg-iris/10"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-secondary px-2 font-medium">1 шт.</span>
                    )}

                    {/* Total price & delete */}
                    <div className="text-right min-w-[65px]">
                      <span className="text-xs font-bold text-text-primary block">{itemTotal} ₴</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateQty(item.id, item.item_type, -item.quantity)}
                      className="p-1 rounded text-rose hover:bg-rose/10 transition-colors cursor-pointer"
                    >
                      <IconDelete size={14} />
                    </button>
                  </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Checkout section */}
      <form onSubmit={handleCheckout} className="mt-4 pt-4 border-t border-warm-border/50 space-y-4">
        {/* Note input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-text-secondary">Коментар до замовлення</label>
          <input
            type="text"
            placeholder="Внутрішня нотатка..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-xl border border-iris/20 bg-surface px-3 py-2 text-xs outline-none focus:border-violet"
          />
        </div>

        {selectedCustomerId && cart.some(c => c.item_type === "device") && (
          <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer p-2 rounded-xl bg-violet/5 border border-violet/10">
            <input
              type="checkbox"
              checked={linkDeviceToCustomer}
              onChange={(e) => setLinkDeviceToCustomer(e.target.checked)}
              className="rounded border-iris/30 text-violet focus:ring-violet/30 cursor-pointer w-4 h-4"
            />
            <span className="font-medium">Прив'язати телефон до клієнта</span>
          </label>
        )}

        {/* Split payments calculator */}
        <div className="p-3.5 bg-surface dark:bg-zinc-900 rounded-xl border border-warm-border/60 text-xs space-y-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary font-semibold">Метод оплати</span>
            <div className="flex bg-black/5 rounded-xl p-1 border border-warm-border/50 relative">
              {/* Cash button */}
              <button
                type="button"
                onClick={() => { setIsSplit(false); setPaymentMethod("cash"); }}
                className={`relative px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer select-none z-10 ${
                  !isSplit && paymentMethod === "cash" ? "text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {!isSplit && paymentMethod === "cash" && (
                  <motion.div
                    layoutId="active-payment-pill"
                    className="absolute inset-0 bg-violet rounded-lg -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span>Готівка</span>
              </button>

              {/* Card button */}
              <button
                type="button"
                onClick={() => { setIsSplit(false); setPaymentMethod("card"); }}
                className={`relative px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer select-none z-10 ${
                  !isSplit && paymentMethod === "card" ? "text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {!isSplit && paymentMethod === "card" && (
                  <motion.div
                    layoutId="active-payment-pill"
                    className="absolute inset-0 bg-violet rounded-lg -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span>Картка</span>
              </button>

              {/* Split button */}
              <button
                type="button"
                onClick={() => setIsSplit(true)}
                className={`relative px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer select-none z-10 ${
                  isSplit ? "text-white" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {isSplit && (
                  <motion.div
                    layoutId="active-payment-pill"
                    className="absolute inset-0 bg-violet rounded-lg -z-10 shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span>Split</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSplit && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3 pt-2 border-t border-iris/5 overflow-hidden"
              >
                <div>
                  <label htmlFor="cash_amount" className="text-[10px] text-text-secondary block mb-1">Сплачено готівкою (₴)</label>
                  <input
                    id="cash_amount"
                    type="number"
                    value={cashAmount}
                    onChange={e => {
                      setCashAmount(e.target.value);
                      const val = parseFloat(e.target.value) || 0;
                      setCardAmount(Math.max(0, finalTotal - val).toString());
                    }}
                    className="w-full rounded-lg border border-iris/20 bg-surface px-2 py-1.5 outline-none focus:border-violet text-right"
                  />
                </div>
                <div>
                  <label htmlFor="card_amount" className="text-[10px] text-text-secondary block mb-1">Сплачено карткою (₴)</label>
                  <input
                    id="card_amount"
                    type="number"
                    value={cardAmount}
                    onChange={e => {
                      setCardAmount(e.target.value);
                      const val = parseFloat(e.target.value) || 0;
                      setCashAmount(Math.max(0, finalTotal - val).toString());
                    }}
                    className="w-full rounded-lg border border-iris/20 bg-surface px-2 py-1.5 outline-none focus:border-violet text-right"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Calculations summaries */}
        <div className="space-y-1.5 text-xs text-text-secondary">
          <div className="flex justify-between">
            <span>Проміжний підсумок:</span>
            <span className="font-semibold text-text-primary">{cartSubtotal} ₴</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald">
              <span>Знижка ({discount}%):</span>
              <span className="font-semibold">-{Math.round(cartSubtotal * (discount / 100))} ₴</span>
            </div>
          )}
          <div className="flex justify-between border-t border-iris/10 pt-2 text-sm">
            <span className="text-text-primary font-bold">Разом до оплати:</span>
            <span className="text-violet font-extrabold text-lg">{finalTotal} ₴</span>
          </div>
        </div>

        {actionError && (
          <div className="p-3 bg-rose/10 border border-rose/25 text-rose rounded-xl text-xs font-semibold">
            {actionError}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || cart.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet hover:bg-violet-hover text-white py-3.5 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {pending ? (
            <>
              <IconSpinner className="h-4 w-4 animate-spin" />
              <span>Обробка транзакції...</span>
            </>
          ) : (
            <span>Провести продаж чека</span>
          )}
        </button>
      </form>
    </div>
  );
}
