import { CartItem, Device, Accessory, Part, Service } from "./pos-types";
import { catalogItemName, toCartItem, type CartItemType } from "./pos-cart-item";

/** Замовлення, яке каса видає: рівно те, що потрібно чеку. */
export interface CheckoutOrder {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name: string | null;
  /** Аванс, уже внесений клієнтом. Каса його не збирає вдруге. */
  deposit: number;
  items: { item_type: CartItemType; item_name: string; unit_price: number; quantity: number }[];
}

export interface OrderCatalogs {
  devices: Device[];
  accessories: Accessory[];
  parts: Part[];
  services: Service[];
}

export interface OrderPrefill {
  cart: CartItem[];
  /** Позиції, яким не знайшлось пари на складі, — їх касир додає руками. */
  unmatched: string[];
}

/** Назви в замовленні пише людина: регістр і подвійні пробіли значення не мають. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Наповнює кошик позиціями замовлення, знайденими на складі.
 *
 * Зіставлення — за назвою, і це свідомо не «розумний» пошук. Замовлення
 * зберігає лише текст (`client_order_items.item_name`), бо на момент
 * оформлення товару на складі ще немає; коли він приїжджає, його заводять
 * окремою карткою. Точний збіг назви — єдиний зв'язок, який не вигадує пару:
 * помилитись позицією в чеку дорожче, ніж додати її руками.
 *
 * Ціна береться з замовлення, а не з каталогу: з клієнтом домовлялись про неї.
 * Собівартість — з каталогу, бо тільки там вона є.
 */
export function prefillFromOrder(order: CheckoutOrder, catalogs: OrderCatalogs): OrderPrefill {
  const byType: Record<CartItemType, { id: string }[]> = {
    device: catalogs.devices,
    accessory: catalogs.accessories,
    part: catalogs.parts,
    service: catalogs.services,
  };

  const cart: CartItem[] = [];
  const unmatched: string[] = [];

  for (const line of order.items) {
    const pool = byType[line.item_type] ?? [];
    const wanted = normalize(line.item_name);
    const found = pool.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c) => normalize(catalogItemName(c as any, line.item_type)) === wanted,
    );

    // Той самий товар двічі в одному замовленні — рідкість, але кошик не
    // дозволяє двох рядків з одним id, тож кількості складаються.
    const already = found ? cart.find((c) => c.id === found.id && c.item_type === line.item_type) : undefined;
    if (already) {
      already.quantity += line.quantity;
      continue;
    }

    if (!found) {
      unmatched.push(line.item_name);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = toCartItem(found as any, line.item_type);
    cart.push({ ...item, unit_price: line.unit_price, quantity: line.quantity });
  }

  return { cart, unmatched };
}
