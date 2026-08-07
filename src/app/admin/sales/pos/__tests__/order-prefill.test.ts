import { describe, it, expect } from "vitest";
import { prefillFromOrder, type CheckoutOrder, type OrderCatalogs } from "../order-prefill";
import type { Accessory, Device, Part, Service } from "../pos-types";

/**
 * Видача замовлення через касу: кошик наповнюється тим, що знайшлось на складі.
 *
 * Ціна тут завжди з замовлення, а собівартість завжди зі складу — саме на цій
 * парі тримається правдивий прибуток чека, і саме її найлегше переплутати.
 */

const accessory = (over: Partial<Accessory> = {}): Accessory => ({
  id: "acc-1",
  name: "Шкіряний чохол-книжка GETMAN Cubic (PU) для Samsung Galaxy A14 4G/5G (Чорний)",
  sku: null,
  price: 350,
  cost_price: 200,
  stock: 3,
  status: "active",
  ...over,
});

const catalogs = (over: Partial<OrderCatalogs> = {}): OrderCatalogs => ({
  devices: [] as Device[],
  accessories: [accessory()],
  parts: [] as Part[],
  services: [] as Service[],
  ...over,
});

const order = (items: CheckoutOrder["items"], deposit = 101): CheckoutOrder => ({
  id: "order-1",
  order_no: "0009",
  customer_id: "cust-1",
  customer_name: "Клієнт",
  deposit,
  items,
});

describe("prefillFromOrder", () => {
  it("бере ціну з замовлення, а собівартість зі складу", () => {
    const { cart, unmatched } = prefillFromOrder(
      order([
        {
          item_type: "accessory",
          item_name: accessory().name,
          unit_price: 320,
          quantity: 1,
        },
      ]),
      catalogs(),
    );

    expect(unmatched).toEqual([]);
    expect(cart).toHaveLength(1);
    // Домовлена з клієнтом ціна, а не прайсова 350.
    expect(cart[0].unit_price).toBe(320);
    expect(cart[0].unit_cost).toBe(200);
    expect(cart[0].id).toBe("acc-1");
  });

  it("зіставляє назви попри регістр і подвійні пробіли", () => {
    const { cart, unmatched } = prefillFromOrder(
      order([
        {
          item_type: "accessory",
          item_name: "  шкіряний  чохол-книжка GETMAN Cubic (PU) ДЛЯ Samsung Galaxy A14 4G/5G (Чорний) ",
          unit_price: 350,
          quantity: 1,
        },
      ]),
      catalogs(),
    );

    expect(unmatched).toEqual([]);
    expect(cart).toHaveLength(1);
  });

  it("не вигадує пару: чого немає на складі — те в unmatched", () => {
    const { cart, unmatched } = prefillFromOrder(
      order([
        { item_type: "accessory", item_name: "Чохол якого немає", unit_price: 500, quantity: 1 },
      ]),
      catalogs(),
    );

    expect(cart).toEqual([]);
    expect(unmatched).toEqual(["Чохол якого немає"]);
  });

  it("не шукає аксесуар серед девайсів: тип має збігатись", () => {
    const { unmatched } = prefillFromOrder(
      order([
        { item_type: "device", item_name: accessory().name, unit_price: 350, quantity: 1 },
      ]),
      catalogs(),
    );

    expect(unmatched).toHaveLength(1);
  });

  it("девайс зіставляється за парою «бренд модель»", () => {
    const device: Device = {
      id: "dev-1",
      brand: "Samsung",
      model: "A07",
      imei: "111",
      price: 4500,
      cost_price: 3000,
      repair_cost: 200,
      status: "in_stock",
    };

    const { cart, unmatched } = prefillFromOrder(
      order([{ item_type: "device", item_name: "samsung a07", unit_price: 4400, quantity: 1 }]),
      catalogs({ devices: [device] }),
    );

    expect(unmatched).toEqual([]);
    // Закупівля плюс вкладений ремонт — інакше чек занизив би собівартість.
    expect(cart[0].unit_cost).toBe(3200);
    expect(cart[0].unit_price).toBe(4400);
  });

  it("той самий товар двома рядками замовлення складається в кількість", () => {
    const line = {
      item_type: "accessory" as const,
      item_name: accessory().name,
      unit_price: 350,
      quantity: 1,
    };

    const { cart } = prefillFromOrder(order([line, { ...line, quantity: 2 }]), catalogs());

    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
  });
});
