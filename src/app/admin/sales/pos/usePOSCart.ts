import { useState, useMemo, useEffect } from "react";
import { CartItem, CatalogItem, Device, Accessory, Part, Service } from "./pos-types";
import { calculateDiscountedPrice } from "@/lib/utils/finance";

export function usePOSCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }, [cart]);

  const finalTotal = useMemo(() => {
    const discounted = calculateDiscountedPrice(cartSubtotal, discount);
    return Math.max(0, discounted);
  }, [cartSubtotal, discount]);

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
      /* Для девайса собівартість — це закупівля ПЛЮС вкладений ремонт. Раніше
         сюди йшов лише `cost_price`, і `sale_items.unit_cost` виходив занижений:
         на шести проданих апаратах загубилось 3 200 ₴ (виправлено бекфілом
         `20260804184802`). На екранах це не було видно, бо `profit.ts:itemCost`
         бере собівартість із `devices`, а не з рядка продажу — але SQL-функції
         читають саме колонку, тож TS і SQL давали різні числа. */
      const unitCost =
        type === "service"
          ? 0
          : type === "device"
            ? ((item as Device).cost_price || 0) + ((item as Device).repair_cost || 0)
            : (item as Accessory | Part).cost_price || 0;
      
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

  const clearCart = () => setCart([]);

  return {
    cart,
    setCart,
    discount,
    setDiscount,
    cartSubtotal,
    finalTotal,
    addToCart,
    updateQty,
    updatePrice,
    clearCart
  };
}
