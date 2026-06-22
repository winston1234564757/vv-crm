"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createMultiSaleAction } from "@/lib/actions/sales";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import { calculateDiscountedPrice } from "@/lib/utils/finance";
import ReceiptPrintModal from "@/components/ui/ReceiptPrintModal";
import {
  IconSearch,
  IconDelete,
  IconSpinner,
  IconDevice,
  IconAccessory,
  IconBox,
  IconRepair
} from "@/components/icons";

interface Customer {
  id: string;
  name: string;
  phone: string;
  discount_percent: number;
}
interface CashRegister {
  id: string;
  name: string;
}
interface Device { id: string; brand: string | null; model: string | null; imei: string | null; price: number; cost_price: number; status: string; warranty_months?: number; photo_urls?: string[] | null; }
interface Accessory { id: string; name: string; sku: string | null; price: number; cost_price: number; stock: number; status: string; warranty_months?: number; photo_urls?: string[] | null; }
interface Part { id: string; name: string; sku?: string | null; price: number | null; cost_price: number; stock: number; status?: string; photo_urls?: string[] | null; }
interface Service { id: string; name: string; price: number; status: string; warranty_days?: number | null; photo_urls?: string[] | null; }

type CatalogItem = Device | Accessory | Part | Service;

interface CartItem {
  id: string;
  name: string;
  item_type: "device" | "accessory" | "part" | "service";
  unit_price: number;
  unit_cost: number;
  quantity: number;
  maxStock?: number;
  imei?: string | null;
  sku?: string | null;
}

interface LastSaleData {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  seller_name: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  total_amount: number;
  discount: number;
  register_name: string;
}

export function POSClient({
  customers,
  devices,
  accessories,
  parts,
  services,
}: {
  customers: Customer[];
  cashRegisters: CashRegister[];
  devices: Device[];
  accessories: Accessory[];
  parts: Part[];
  services: Service[];
}) {
  const router = useRouter();
  
  // Cart & UI State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "transfer">("cash");
  
  const [activeCategory, setActiveCategory] = useState<"device" | "accessory" | "part" | "service" | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeMobileTab, setActiveMobileTab] = useState<"catalog" | "cart">("catalog");
  const [promoCode, setPromoCode] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [promoMessage, setPromoMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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
  const [lastSaleData, setLastSaleData] = useState<LastSaleData | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [actionError, setActionError] = useState<string>("");

  // Subtotals
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }, [cart]);

  const finalTotal = useMemo(() => {
    const discounted = calculateDiscountedPrice(cartSubtotal, discount);
    return Math.max(0, discounted);
  }, [cartSubtotal, discount]);

  // Adjust cash/card splits when total changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCashAmount(finalTotal.toString());
    setCardAmount("0");
  }, [finalTotal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filters for available stock in real-time
  const inStockDevices = useMemo(() => {
    const cartDeviceIds = new Set(cart.filter(c => c.item_type === "device").map(c => c.id));
    return devices.filter(d => d.status === "in_stock" && !cartDeviceIds.has(d.id));
  }, [devices, cart]);

  const activeAccessories = useMemo(() => {
    return accessories.filter(a => a.stock > 0 && a.status === "active");
  }, [accessories]);

  const activeParts = useMemo(() => {
    return parts.filter(p => p.stock > 0);
  }, [parts]);

  const activeServices = useMemo(() => {
    return services.filter(s => s.status === "active");
  }, [services]);

  // Search logic for active items in selected category
  const filteredCatalogItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (activeCategory === "device") {
      return inStockDevices.filter(d => 
        `${d.brand} ${d.model}`.toLowerCase().includes(query) || (d.imei && d.imei.includes(query))
      );
    }
    if (activeCategory === "accessory") {
      return activeAccessories.filter(a => 
        a.name.toLowerCase().includes(query) || (a.sku && a.sku.toLowerCase().includes(query))
      );
    }
    if (activeCategory === "part") {
      return activeParts.filter(p => 
        p.name.toLowerCase().includes(query) || (p.sku && p.sku.toLowerCase().includes(query))
      );
    }
    if (activeCategory === "service") {
      return activeServices.filter(s => s.name.toLowerCase().includes(query));
    }
    return [];
  }, [activeCategory, searchQuery, inStockDevices, activeAccessories, activeParts, activeServices]);

  // Smart Recommendations Engine based on cart contents
  const recommendations = useMemo(() => {
    if (cart.length === 0) return [];

    const recs: Array<{
      item: Accessory | Part;
      type: "accessory" | "part";
      reason: string;
    }> = [];

    const addedIds = new Set<string>();

    const hasChargingPort = cart.some(c => c.name.toLowerCase().includes("гнізд"));
    const hasScreen = cart.some(c => 
      c.name.toLowerCase().includes("екран") || 
      c.name.toLowerCase().includes("скло") || 
      c.name.toLowerCase().includes("диспл")
    );
    const hasBattery = cart.some(c => 
      c.name.toLowerCase().includes("акумул") || 
      c.name.toLowerCase().includes("батаре")
    );
    const hasDevice = cart.some(c => c.item_type === "device");

    const isAlreadyInCart = (id: string, type: string) => {
      return cart.some(c => c.id === id && c.item_type === type);
    };

    // Rule 1: Charging port repair -> USB-C / Lightning Cables & Chargers
    if (hasChargingPort) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (
            lowerName.includes("кабель") || 
            lowerName.includes("зарядк") || 
            lowerName.includes("кабел") || 
            lowerName.includes("зарядн") || 
            lowerName.includes("usb") || 
            lowerName.includes("type-c") || 
            lowerName.includes("lightning")
          ) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "До ремонту гнізда (новий кабель / зарядний пристрій)" 
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    // Rule 2: Screen / Glass repair -> Protective Glass / Film
    if (hasScreen) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (lowerName.includes("скло") || lowerName.includes("плівк") || lowerName.includes("захисн")) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "До заміни екрану (захисне скло / плівка)" 
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    // Rule 3: Battery replacement -> Power Banks & Chargers
    if (hasBattery) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (
            lowerName.includes("powerbank") || 
            lowerName.includes("паверб") || 
            lowerName.includes("зарядк") || 
            lowerName.includes("зарядн") || 
            lowerName.includes("акумулятор")
          ) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "До нового акумулятора (павербанк / зарядка)" 
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    // Rule 4: Physical Device -> Cases, Glass Protectors, Cables
    if (hasDevice) {
      accessories.forEach(acc => {
        if (acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory") && !addedIds.has(acc.id)) {
          const lowerName = acc.name.toLowerCase();
          if (
            lowerName.includes("чохол") || 
            lowerName.includes("чехол") || 
            lowerName.includes("скло") || 
            lowerName.includes("кабель") || 
            lowerName.includes("плівк")
          ) {
            recs.push({ 
              item: acc, 
              type: "accessory", 
              reason: "Супутній аксесуар до придбаного пристрою" 
            });
            addedIds.add(acc.id);
          }
        }
      });
    }

    // Default recommendation: suggest top accessories with highest stock
    if (recs.length === 0) {
      const topAccessories = [...accessories]
        .filter(acc => acc.stock > 0 && acc.status === "active" && !isAlreadyInCart(acc.id, "accessory"))
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 3);
      
      topAccessories.forEach(acc => {
        recs.push({ 
          item: acc, 
          type: "accessory", 
          reason: "Популярний аксесуар з високим запасом" 
        });
      });
    }

    return recs.slice(0, 3); // Limit to top 3 recommendations to keep clean
  }, [cart, accessories, parts]);

  // Quick Promo validation
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

  // Add Item to Cart
  const addToCart = (item: CatalogItem, type: "device" | "accessory" | "part" | "service") => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id && c.item_type === type);
      if (existing) {
        if (type === "device") return prev; // Devices strictly qty=1
        const nextQty = existing.quantity + 1;
        if (existing.maxStock && nextQty > existing.maxStock) {
          alert(`Максимальна кількість на складі: ${existing.maxStock} шт.`);
          return prev;
        }
        return prev.map(c => c.id === item.id && c.item_type === type ? { ...c, quantity: nextQty } : c);
      }

      const name = type === "device"
        ? `${(item as Device).brand || ""} ${(item as Device).model || ""}`.trim() || "Девайс"
        : (item as Accessory | Part | Service).name;
      const stock = type === "accessory" || type === "part" ? (item as Accessory | Part).stock : undefined;
      const sku = type === "accessory" || type === "part" ? (item as Accessory | Part).sku : undefined;
      const imei = type === "device" ? (item as Device).imei : undefined;
      const unitCost = type === "service" ? 0 : (item as Device | Accessory | Part).cost_price || 0;
      
      const newCartItem: CartItem = {
        id: item.id,
        name,
        item_type: type,
        unit_price: item.price || 0,
        unit_cost: unitCost,
        quantity: 1,
        maxStock: stock,
        imei,
        sku,
      };
      return [...prev, newCartItem];
    });
  };

  // Remove / Edit quantity in Cart
  const updateQty = (id: string, type: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.id === id && c.item_type === type) {
          const nextQty = c.quantity + delta;
          if (nextQty <= 0) return null;
          if (c.maxStock && nextQty > c.maxStock) return c;
          return { ...c, quantity: nextQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
  };

  const updatePrice = (id: string, type: string, priceStr: string) => {
    const priceVal = parseFloat(priceStr) || 0;
    setCart(prev => prev.map(c => c.id === id && c.item_type === type ? { ...c, unit_price: priceVal } : c));
  };

  // New customer flow
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

  // Customer selection logic
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

  // Submit sale order
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setPending(true);
    setActionError("");

    const payload = {
      customer_id: selectedCustomerId || null,
      discount,
      notes,
      is_split: isSplit,
      cash_amount: isSplit ? parseFloat(cashAmount) || 0 : 0,
      card_amount: isSplit ? parseFloat(cardAmount) || 0 : 0,
      method: paymentMethod,
      sale_type: "retail",
      delivery_needed: false,
      partner_id: partnerId || null,
      promo_code_used: promoCode.trim() || null,
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
          total_price: c.unit_price * c.quantity
        })),
        total_amount: finalTotal,
        discount: discount,
        register_name: "Основна каса"
      });
      setSuccessSaleId(res.data.saleId);
      setCart([]);
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
      <div className="flex lg:hidden bg-warm-sidebar rounded-2xl p-1 border border-warm-border/50 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMobileTab("catalog")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
            activeMobileTab === "catalog"
              ? "bg-white text-text-primary shadow-sm"
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
              ? "bg-white text-text-primary shadow-sm"
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
        <div className={`${activeMobileTab === "cart" ? "flex" : "hidden lg:flex"} w-full lg:w-[42%] flex-col justify-between card p-5 bg-gradient-to-br from-violet/5 to-iris/5 border-iris/15 max-h-[85vh] overflow-y-auto`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-iris/10 pb-3">
            <h2 className="text-base font-semibold text-text-primary">Кошик замовлення</h2>
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
                    className="w-full rounded-lg border border-iris/20 bg-white px-2.5 py-1.5 outline-none focus:border-violet"
                  />
                  <input
                    type="text"
                    placeholder="Телефон"
                    value={newCustPhone}
                    onChange={e => setNewCustPhone(e.target.value)}
                    className="w-full rounded-lg border border-iris/20 bg-white px-2.5 py-1.5 outline-none focus:border-violet"
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
                className="w-full rounded-xl border border-iris/20 bg-white px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-violet"
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
                        className={`flex items-center justify-between p-3 rounded-xl bg-white border transition-all duration-200 overflow-hidden ${
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

      {/* Smart Recommendations Section */}
      {recommendations.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-violet/10 to-iris/10 border border-violet/20 space-y-3 mt-1 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs">💡</span>
              <h3 className="text-[11px] font-extrabold text-violet tracking-tight uppercase">Допродажі та Рекомендації</h3>
            </div>
            <span className="text-[9px] font-bold text-violet bg-white/60 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              Smart POS
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {recommendations.map((rec) => {
              const price = rec.item.price || 0;
              return (
                <div 
                  key={`${rec.item.id}-${rec.type}`}
                  onClick={() => addToCart(rec.item, rec.type)}
                  className="flex items-center justify-between bg-white/70 hover:bg-white/90 border border-violet/10 hover:border-violet/30 p-2.5 rounded-xl transition-all duration-200 cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-text-primary truncate block max-w-[170px] group-hover:text-violet transition-colors">
                        {rec.item.name}
                      </span>
                      <span className="text-[9px] text-text-secondary shrink-0 font-mono">
                        ({rec.item.stock} шт)
                      </span>
                    </div>
                    <p className="text-[9px] text-[#A855F7] font-medium leading-tight mt-0.5">
                      {rec.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-extrabold text-violet">
                      {price} ₴
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-violet/10 text-violet font-bold text-xs group-hover:bg-violet group-hover:text-white transition-all">
                      +
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>

        {/* Totals & Payments */}
        {cart.length > 0 && (
          <form onSubmit={handleCheckout} className="mt-5 pt-4 border-t border-iris/10 space-y-4">
            
            {/* Promo codes */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Промокод партнера"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                className="flex-1 rounded-xl border border-iris/20 bg-white px-3 py-2 text-xs outline-none focus:border-violet"
              />
              <button
                type="button"
                onClick={handleCheckPromo}
                className="btn px-4 py-2 bg-violet/10 text-violet hover:bg-violet/15 text-xs font-medium"
              >
                Застосувати
              </button>
            </div>
            {promoMessage && (
              <p className={`text-[10px] font-semibold ${promoMessage.type === "success" ? "text-emerald" : "text-rose"}`}>
                {promoMessage.text}
              </p>
            )}

            {/* Note & Comment */}
            <div>
              <input
                type="text"
                placeholder="Коментар до чека..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full rounded-xl border border-iris/20 bg-white px-3 py-2 text-xs outline-none focus:border-violet"
              />
            </div>

            {/* Split payments calculator */}
            <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-warm-border/60 text-xs space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary font-semibold">Метод оплати</span>
                <div className="flex bg-warm-bg dark:bg-zinc-950 rounded-xl p-1 border border-warm-border/50 relative">
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
                        className="w-full rounded-lg border border-iris/20 bg-white px-2 py-1.5 outline-none focus:border-violet text-right"
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
                        className="w-full rounded-lg border border-iris/20 bg-white px-2 py-1.5 outline-none focus:border-violet text-right"
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
              disabled={pending}
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
        )}
      </div>

      {/* RIGHT COLUMN: Bento Storefront Grid */}
      <div className={`${activeMobileTab === "catalog" ? "flex" : "hidden lg:flex"} w-full lg:w-[58%] flex-col gap-4 max-h-[85vh] overflow-y-auto pr-1`}>
        
        {/* Bento header and Navigation */}
        <div className="flex items-center justify-between bg-white border border-warm-border/50 p-4 rounded-2xl">
          <div>
            <span className="text-[10px] font-bold text-violet tracking-wider uppercase">Візуальна Вітрина POS</span>
            <h1 className="text-lg font-bold text-text-primary mt-0.5">
              {activeCategory === null ? "Каталог категорій" : 
               activeCategory === "device" ? "Смартфони та Девайси" :
               activeCategory === "accessory" ? "Складські Аксесуари" :
               activeCategory === "part" ? "Запчастини зі Складу" : "Послуги майстерні"}
            </h1>
          </div>

          {activeCategory !== null && (
            <button
              onClick={() => { setActiveCategory(null); setSearchQuery(""); }}
              className="btn-press flex items-center gap-2 rounded-xl bg-violet/10 hover:bg-violet/20 border border-violet/30 text-violet px-6 py-3 text-sm font-bold shadow-sm active:scale-95 transition-all duration-200"
            >
              ← Назад до категорій
            </button>
          )}
        </div>

        {/* Category listing (Bento Grid) */}
        {activeCategory === null ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.08 }
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
          >
            
            {/* Devices Category Card (Wide) */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 15 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveCategory("device")}
              className="md:col-span-2 cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-gradient-to-br from-cyan to-blue text-white p-5 flex flex-col justify-between shadow-lg shadow-cyan/5 transition-all duration-300 group"
            >
              <div className="absolute right-4 bottom-2 opacity-15 transform translate-y-1 translate-x-1 group-hover:scale-110 transition-transform duration-300">
                <IconDevice size={130} />
              </div>
              <span className="bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
                {inStockDevices.length} шт. в наявності
              </span>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Техніка</h3>
                <p className="text-xs text-white/80 mt-1">Телефони, планшети, унікальні IMEI товари</p>
              </div>
            </motion.div>

            {/* Accessories Category Card */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 15 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveCategory("accessory")}
              className="cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-gradient-to-br from-violet to-iris text-white p-5 flex flex-col justify-between shadow-lg shadow-violet/5 transition-all duration-300 group"
            >
              <div className="absolute right-3 bottom-1 opacity-20 group-hover:scale-110 transition-transform duration-300">
                <IconAccessory size={95} />
              </div>
              <span className="bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
                Активні товари
              </span>
              <div>
                <h3 className="text-lg font-bold">Аксесуари</h3>
                <p className="text-[11px] text-white/85 mt-1">Скла, кабелі, чохли</p>
              </div>
            </motion.div>

            {/* Parts Category Card */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 15 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveCategory("part")}
              className="cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-gradient-to-br from-amber to-orange-500 text-white p-5 flex flex-col justify-between shadow-lg shadow-amber/5 transition-all duration-300 group"
            >
              <div className="absolute right-3 bottom-1 opacity-20 group-hover:scale-110 transition-transform duration-300">
                <IconBox size={95} />
              </div>
              <span className="bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
                Склад деталей
              </span>
              <div>
                <h3 className="text-lg font-bold">Запчастини</h3>
                <p className="text-[11px] text-white/85 mt-1">Окремий продаж деталей клієнту</p>
              </div>
            </motion.div>

            {/* Services Category Card (Wide) */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 15 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveCategory("service")}
              className="md:col-span-2 cursor-pointer relative overflow-hidden rounded-3xl min-h-[160px] bg-gradient-to-br from-emerald to-teal-600 text-white p-5 flex flex-col justify-between shadow-lg shadow-emerald/5 transition-all duration-300 group"
            >
              <div className="absolute right-4 bottom-2 opacity-20 group-hover:scale-110 transition-transform duration-300">
                <IconRepair size={115} />
              </div>
              <span className="bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full w-max">
                {activeServices.length} послуг в каталозі
              </span>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Послуги</h3>
                <p className="text-xs text-white/85 mt-1">Роботи з наклеювання, чищення та налаштування</p>
              </div>
            </motion.div>

          </motion.div>
        ) : (
          /* Category's Products view */
          <div className="space-y-4">
            
            {/* Search Input for items */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                placeholder="Пошук за назвою, брендом, моделлю чи кодом..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-warm-border bg-white pl-9 pr-4 py-3 text-sm text-text-primary outline-none focus:border-violet/40"
              />
            </div>

            {/* Grid display of filtered items */}
            {filteredCatalogItems.length === 0 ? (
              <div className="card text-center py-16 text-xs text-text-secondary/50 italic bg-white border-warm-border/50">
                Товарів у цій категорії не знайдено.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {filteredCatalogItems.map((item) => {
                  const hasPhoto = !!(item.photo_urls && item.photo_urls.length > 0);
                  const photoUrl = hasPhoto && item.photo_urls ? item.photo_urls[0] : "";
                  
                  // Safe fields casting
                  let displayName = "";
                  let displayImei = "";
                  let displaySku = "";
                  let displayStock: number | null = null;
                  let displayPrice = 0;

                  if (activeCategory === "device") {
                    const dev = item as Device;
                    displayName = `${dev.brand || ""} ${dev.model || ""}`.trim() || "Пристрій";
                    displayImei = dev.imei || "";
                    displayPrice = dev.price;
                  } else if (activeCategory === "accessory") {
                    const acc = item as Accessory;
                    displayName = acc.name;
                    displaySku = acc.sku || "";
                    displayStock = acc.stock;
                    displayPrice = acc.price;
                  } else if (activeCategory === "part") {
                    const prt = item as Part;
                    displayName = prt.name;
                    displaySku = prt.sku || "";
                    displayStock = prt.stock;
                    displayPrice = prt.price || 0;
                  } else if (activeCategory === "service") {
                    const srv = item as Service;
                    displayName = srv.name;
                    displayPrice = srv.price;
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item, activeCategory)}
                      className="cursor-pointer border border-warm-border/50 bg-white hover:border-violet/30 hover:shadow-md rounded-2xl p-3 flex flex-col justify-between gap-3 transition-all duration-200 group relative overflow-hidden"
                    >
                      {/* Product Visual element */}
                      <div className={`w-full h-32 rounded-xl flex items-center justify-center overflow-hidden border border-warm-border/20 relative ${
                        hasPhoto ? "bg-warm-surface" : 
                        activeCategory === "device" ? "bg-gradient-to-br from-cyan/10 to-blue/5 text-cyan" :
                        activeCategory === "accessory" ? "bg-gradient-to-br from-violet/10 to-iris/5 text-violet" :
                        activeCategory === "part" ? "bg-gradient-to-br from-amber/10 to-orange-500/5 text-amber" : 
                        "bg-gradient-to-br from-emerald/10 to-teal-600/5 text-emerald"
                      }`}>
                        {hasPhoto ? (
                          <img
                            src={photoUrl}
                            alt={displayName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="group-hover:scale-110 transition-transform duration-300">
                            {activeCategory === "device" ? <IconDevice size={45} /> :
                             activeCategory === "accessory" ? <IconAccessory size={45} /> :
                             activeCategory === "part" ? <IconBox size={45} /> : <IconRepair size={45} />}
                          </div>
                        )}

                        {/* Quantity / stock indicators */}
                        {displayStock !== null && (
                          <span className={`absolute right-2 bottom-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            displayStock <= 2 ? "bg-rose/10 text-rose" : "bg-emerald/10 text-emerald"
                          }`}>
                            Стік: {displayStock} шт
                          </span>
                        )}
                      </div>

                      {/* Info details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-text-primary leading-tight line-clamp-2">
                            {displayName}
                          </h4>
                          {displayImei && (
                            <p className="text-[9px] text-text-secondary font-mono mt-1 truncate">
                              IMEI: {displayImei}
                            </p>
                          )}
                          {displaySku && (
                            <p className="text-[9px] text-text-secondary mt-1 truncate">
                              SKU: {displaySku}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-iris/5">
                          <span className="text-xs font-extrabold text-violet">
                            {displayPrice} ₴
                          </span>
                          <span className="text-[10px] text-violet font-semibold bg-violet/5 rounded-lg px-2.5 py-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                            + Додати
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      </div>

      {/* Success checkout Dialog overlay */}
      <AnimatePresence>
        {successSaleId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
              className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-7 text-center shadow-2xl space-y-5 border border-iris/10"
            >
              {/* Dynamic Checkmark Animation */}
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
                <h3 className="text-lg font-bold text-text-primary">Продаж успішно проведено!</h3>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  Транзакцію успішно записано. Виберіть подальшу дію або роздрукуйте чек для клієнта.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSuccessSaleId(null)}
                  className="flex-1 btn-press py-3 px-4 border border-warm-border/80 bg-warm-surface text-text-secondary hover:bg-iris/5 text-xs font-semibold rounded-xl cursor-pointer transition-colors active:scale-[0.98]"
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
                className="w-full text-xs font-medium text-text-secondary/60 hover:text-violet hover:underline pt-1 cursor-pointer transition-colors"
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
