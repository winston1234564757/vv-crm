export const dynamic = "force-dynamic";

import { getCustomers } from "@/lib/data-customers";
import { getCashRegisters } from "@/lib/data-finance";
import { getDevices } from "@/lib/data-devices";
import { getAccessories } from "@/lib/data-accessories";
import { getServices } from "@/lib/data-services";
import { getParts } from "@/lib/data-parts";
import { getOrderForCheckout } from "@/lib/data-orders";
import { POSClient } from "./POSClient";
import type { CheckoutOrder } from "./order-prefill";
import type { CartItemType } from "./pos-cart-item";

export default async function POSPage({
  searchParams,
}: {
  /** `?order=<id>` — каса відкривається як видача клієнтського замовлення. */
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;

  const [customers, cashRegisters, devices, accessories, parts, services, order] = await Promise.all([
    getCustomers(),
    getCashRegisters(),
    getDevices(),
    getAccessories(),
    getParts(),
    getServices(),
    orderId ? getOrderForCheckout(orderId) : Promise.resolve(null),
  ]);

  /* Замовлення, за яким уже пробили чек, `getOrderForCheckout` не поверне —
     каса відкриється звичайною, а не з обіцянкою зарахувати аванс удруге. */
  const checkoutOrder: CheckoutOrder | null = order
    ? {
        id: order.id,
        order_no: order.order_no,
        customer_id: order.customer_id,
        customer_name: order.customers?.name ?? null,
        deposit: order.deposit ?? 0,
        items: (order.client_order_items ?? []).map((it) => ({
          item_type: it.item_type as CartItemType,
          item_name: it.item_name,
          unit_price: it.unit_price,
          quantity: it.quantity,
        })),
      }
    : null;

  return (
    <POSClient
      customers={customers}
      cashRegisters={cashRegisters}
      devices={devices}
      accessories={accessories}
      parts={parts}
      services={services}
      order={checkoutOrder}
    />
  );
}
