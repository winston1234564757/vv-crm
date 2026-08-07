import { useState, useMemo } from "react";
import { CartItem, CatalogItem } from "./pos-types";
import { toCartItem } from "./pos-cart-item";
import { calculateDiscountedPrice } from "@/lib/utils/finance";

/**
 * `initialCart` — кошик, наповнений ще до першого рендера: так приходить
 * видача замовлення (`?order=…`). Ефект тут не годиться: він домалював би
 * порожній кошик і лише потім заповнив його, а форма оплати встигла б
 * порахувати суму до сплати з нуля.
 */
export function usePOSCart(initialCart: CartItem[] = []) {
  const [cart, setCart] = useState<CartItem[]>(initialCart);
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

      return [...prev, toCartItem(item, type)];
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
