"use client";

import { useActionState, useEffect, useState } from "react";
import { createQuickSale } from "@/lib/actions/sales";
import { createCustomer } from "@/lib/actions/customers";
import { validatePromoCode } from "@/lib/actions/partners";
import { calculateDiscountedPrice, calculateRemainingSplit } from "@/lib/utils/finance";

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
interface Device {
  id: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  price: number;
  status: string;
  warranty_months?: number;
}
interface Accessory {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  status: string;
  warranty_months?: number;
}
interface Service {
  id: string;
  name: string;
  price: number;
  status: string;
  warranty_days?: number | null;
}

export interface UseSaleFormProps {
  customers: Customer[];
  cashRegisters: CashRegister[];
  devices: Device[];
  accessories: Accessory[];
  services?: Service[];
  initialCategory?: "device" | "accessory" | "service";
  initialItemId?: string;
  onSuccess: () => void;
}

interface SaleFormState {
  success: boolean;
  error: string;
  saleId: string | null;
}

export function useSaleForm({
  customers,
  devices,
  accessories,
  services,
  initialCategory,
  initialItemId,
  onSuccess,
}: UseSaleFormProps) {
  const initialState: SaleFormState = { success: false, error: "", saleId: null };
  const [state, formAction, pending] = useActionState(action, initialState);
  const [custError, setCustError] = useState("");
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [createdSaleId, setCreatedSaleId] = useState<string | null>(null);

  useEffect(() => {
    if (state.success && state.saleId) {
      setCreatedSaleId(state.saleId);
    }
  }, [state.success, state.saleId]);

  const getInitialBasePrice = () => {
    if (!initialItemId || !initialCategory) return 0;
    if (initialCategory === "device") return devices.find((x) => x.id === initialItemId)?.price || 0;
    if (initialCategory === "accessory") return accessories.find((x) => x.id === initialItemId)?.price || 0;
    if (initialCategory === "service" && services) return services.find((x) => x.id === initialItemId)?.price || 0;
    return 0;
  };

  const initialPrice = getInitialBasePrice();

  const [category, setCategory] = useState<"device" | "accessory" | "service">(
    initialCategory ?? "accessory"
  );
  const [itemId, setItemId] = useState<string>(initialItemId ?? "");
  const [amount, setAmount] = useState<string>(initialPrice > 0 ? initialPrice.toString() : "");

  const [discount, setDiscount] = useState<number>(0);
  const [basePrice, setBasePrice] = useState<number>(initialPrice);
  const [isSplit, setIsSplit] = useState<boolean>(false);
  const [cashAmount, setCashAmount] = useState<string>(initialPrice > 0 ? initialPrice.toString() : "");
  const [cardAmount, setCardAmount] = useState<string>("0");

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [promoCode, setPromoCode] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [promoMessage, setPromoMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const [deliveryNeeded, setDeliveryNeeded] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryTracking, setDeliveryTracking] = useState("");

  const [warrantyStart, setWarrantyStart] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const getInitialWarrantyEnd = () => {
    if (!initialItemId || !initialCategory) return "";
    const start = new Date();
    if (initialCategory === "device") {
      const d = devices.find((x) => x.id === initialItemId);
      const months = d?.warranty_months ?? 12;
      if (months > 0) {
        start.setMonth(start.getMonth() + months);
        return start.toISOString().split("T")[0];
      }
    } else if (initialCategory === "accessory") {
      const a = accessories.find((x) => x.id === initialItemId);
      const months = a?.warranty_months ?? 6;
      if (months > 0) {
        start.setMonth(start.getMonth() + months);
        return start.toISOString().split("T")[0];
      }
    } else if (initialCategory === "service" && services) {
      const s = services.find((x) => x.id === initialItemId);
      const days = s?.warranty_days ?? 0;
      if (days > 0) {
        start.setDate(start.getDate() + days);
        return start.toISOString().split("T")[0];
      }
    }
    return "";
  };

  const [warrantyEnd, setWarrantyEnd] = useState<string>(getInitialWarrantyEnd);

  const inStockDevices = devices.filter((d) => d.status === "in_stock");
  const activeAccessories = accessories.filter((a) => a.status === "active" && a.stock > 0);
  const activeServices = (services ?? []).filter((s) => s.status === "active");

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
      setPromoMessage({
        text: `Партнер: ${res.partner.name}. Знижка ${res.partner.discount_percent}%!`,
        type: "success",
      });
    } else {
      setPartnerId("");
      setDiscount(0);
      setAmount(basePrice.toString());
      setCashAmount(basePrice.toString());
      setPromoMessage({
        text: res.error || "Промокод не знайдено",
        type: "error",
      });
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
      setLocalCustomers((prev) => [...prev, created]);
      setSelectedCustomerId(created.id);

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
    // Set delivery attributes to form data if delivery is active
    if (deliveryNeeded) {
      formData.set("delivery_needed", "true");
      formData.set("delivery_address", deliveryAddress);
      formData.set("delivery_tracking", deliveryTracking);
    } else {
      formData.set("delivery_needed", "false");
    }

    formData.set("warranty_start", warrantyStart || "");
    formData.set("warranty_end", warrantyEnd || "");

    const res = await createQuickSale(null, formData);
    if (res.success) {
      return { success: true, error: "", saleId: res.data?.saleId || null };
    }
    return { success: false, error: res.error || "Сталася помилка", saleId: null };
  }

  function handleCategoryChange(cat: "device" | "accessory" | "service") {
    setCategory(cat);
    setItemId("");
    setBasePrice(0);
    setAmount("");
    setDiscount(0);
    setCashAmount("");
    setCardAmount("");
    setWarrantyStart(new Date().toISOString().split("T")[0]);
    setWarrantyEnd("");
  }

  function handleItemSelect(id: string) {
    setItemId(id);
    let price = 0;
    let defaultMonths = 0;
    let defaultDays = 0;

    if (category === "device") {
      const d = inStockDevices.find((x) => x.id === id);
      if (d) {
        price = d.price;
        defaultMonths = d.warranty_months ?? 12;
      }
    } else if (category === "accessory") {
      const a = activeAccessories.find((x) => x.id === id);
      if (a) {
        price = a.price;
        defaultMonths = a.warranty_months ?? 6;
      }
    } else if (category === "service") {
      const s = activeServices.find((x) => x.id === id);
      if (s) {
        price = s.price;
        defaultDays = s.warranty_days ?? 0;
      }
    }
    setBasePrice(price);
    const finalAmount = calculateDiscountedPrice(price, discount);
    setAmount(finalAmount.toString());
    setCashAmount(finalAmount.toString());
    setCardAmount("0");

    const start = new Date();
    setWarrantyStart(start.toISOString().split("T")[0]);

    if (defaultMonths > 0) {
      const end = new Date();
      end.setMonth(end.getMonth() + defaultMonths);
      setWarrantyEnd(end.toISOString().split("T")[0]);
    } else if (defaultDays > 0) {
      const end = new Date();
      end.setDate(end.getDate() + defaultDays);
      setWarrantyEnd(end.toISOString().split("T")[0]);
    } else {
      setWarrantyEnd("");
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
    const customer = localCustomers.find((c) => c.id === id);
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

  const totalAmountVal = parseFloat(amount) || 0;
  const cashAmountVal = parseFloat(cashAmount) || 0;
  const cardAmountVal = parseFloat(cardAmount) || 0;
  const remainingSplit = calculateRemainingSplit(totalAmountVal, cashAmountVal, cardAmountVal);

  const resetForm = () => {
    setItemId("");
    setBasePrice(0);
    setAmount("");
    setDiscount(0);
    setCashAmount("");
    setCardAmount("");
    setWarrantyStart(new Date().toISOString().split("T")[0]);
    setWarrantyEnd("");
    setCreatedSaleId(null);
  };

  return {
    state,
    formAction,
    pending,
    custError,
    localCustomers,
    category,
    itemId,
    amount,
    discount,
    isSplit,
    setIsSplit,
    cashAmount,
    cardAmount,
    showNewCustomer,
    setShowNewCustomer,
    newCustName,
    setNewCustName,
    newCustPhone,
    setNewCustPhone,
    newCustEmail,
    setNewCustEmail,
    selectedCustomerId,
    promoCode,
    setPromoCode,
    promoMessage,
    deliveryNeeded,
    setDeliveryNeeded,
    deliveryAddress,
    setDeliveryAddress,
    deliveryTracking,
    setDeliveryTracking,
    warrantyStart,
    setWarrantyStart,
    warrantyEnd,
    setWarrantyEnd,
    inStockDevices,
    activeAccessories,
    activeServices,
    remainingSplit,
    createdSaleId,
    setCreatedSaleId,
    onSuccess,
    resetForm,
    handleCheckPromo,
    handleCreateCustomer,
    handleCategoryChange,
    handleItemSelect,
    handleCustomerSelect,
    handleAmountChange,
    handleCashAmountChange,
    handleCardAmountChange,
    getAutoRegisterName,
  };
}
