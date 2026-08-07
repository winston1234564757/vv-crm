import { CartItem, CatalogItem, Device, Accessory, Part, Service } from "./pos-types";

export type CartItemType = CartItem["item_type"];

/** Назва позиції каталогу так, як її бачить касир. */
export function catalogItemName(item: CatalogItem, type: CartItemType): string {
  if (type === "device") {
    const d = item as Device;
    return `${d.brand || ""} ${d.model || ""}`.trim() || "Девайс";
  }
  return (item as Accessory | Part | Service).name;
}

/**
 * Позиція каталогу → позиція кошика.
 *
 * Живе окремо від `usePOSCart`, бо в кошик кладе не лише кліком: видача
 * замовлення наповнює кошик ще до першого рендера (`order-prefill.ts`). Дві
 * копії цієї функції означали б дві різні собівартості в одному чеку.
 *
 * Для девайса собівартість — це закупівля ПЛЮС вкладений ремонт. Раніше сюди
 * йшов лише `cost_price`, і `sale_items.unit_cost` виходив занижений: на шести
 * проданих апаратах загубилось 3 200 ₴ (виправлено бекфілом `20260804184802`).
 * На екранах це не було видно, бо `profit.ts:itemCost` бере собівартість із
 * `devices`, а не з рядка продажу — але SQL-функції читають саме колонку, тож
 * TS і SQL давали різні числа.
 */
export function toCartItem(item: CatalogItem, type: CartItemType): CartItem {
  const stock = type === "accessory" || type === "part" ? (item as Accessory | Part).stock : undefined;
  const sku = type === "accessory" || type === "part" ? (item as Accessory | Part).sku : undefined;
  const imei = type === "device" ? (item as Device).imei : undefined;

  const unitCost =
    type === "service"
      ? 0
      : type === "device"
        ? ((item as Device).cost_price || 0) + ((item as Device).repair_cost || 0)
        : (item as Accessory | Part).cost_price || 0;

  return {
    id: item.id,
    name: catalogItemName(item, type),
    item_type: type,
    unit_price: item.price || 0,
    unit_cost: unitCost,
    quantity: 1,
    maxStock: stock,
    imei,
    sku,
  };
}
