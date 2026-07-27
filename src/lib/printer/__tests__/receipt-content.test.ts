import { describe, it, expect } from "vitest";
import {
  DEFAULT_SALE_WARRANTY_BY_CATEGORY,
  composeRepairBreakdown,
  composeSaleWarrantyBody,
  composeWarrantyText,
  saleWarrantyForCategory,
} from "../receipt-content";

/* Текст, який магазин мав до розділення умов по категоріях: написаний під
   пристрої й саме тому не годиться для захисного скла. */
const LEGACY_SALE_TEXT =
  "При виявленні несправностей протягом гарантійного періоду товар приймається на діагностику. " +
  "Гарантія анулюється при самостійному розкритті пристрою.";

describe("умови гарантії по категоріях товару", () => {
  it("продаж однієї категорії друкує лише її умови, без підпису категорії", () => {
    const text = composeSaleWarrantyBody(["accessory"]);
    expect(text).toBe(DEFAULT_SALE_WARRANTY_BY_CATEGORY.accessory);
    expect(text).not.toContain("Аксесуари:");
  });

  it("чек за захисне скло не обіцяє умов, писаних під пристрої", () => {
    const text = composeWarrantyText({
      type: "sale",
      templateText: LEGACY_SALE_TEXT,
      saleCategories: ["accessory"],
      warrantyEndFormatted: "27.01.2027",
    });
    expect(text).toContain("Гарантія дійсна до: 27.01.2027");
    expect(text).not.toContain("розкритті пристрою");
    expect(text).toContain("Захисне скло");
  });

  it("змішаний чек підписує блоки і тримає сталий порядок категорій", () => {
    // Порядок у кошику зворотний до порядку друку — чек має читатись однаково
    // незалежно від того, що касир пробив першим.
    const text = composeSaleWarrantyBody(["service", "accessory", "device"]);
    expect(text.indexOf("Техніка:")).toBeLessThan(text.indexOf("Аксесуари:"));
    expect(text.indexOf("Аксесуари:")).toBeLessThan(text.indexOf("Послуги:"));
    expect(text).not.toContain("Запчастини:");
  });

  it("дублі категорій не подвоюють блок", () => {
    const twice = composeSaleWarrantyBody(["accessory", "accessory"]);
    expect(twice).toBe(DEFAULT_SALE_WARRANTY_BY_CATEGORY.accessory);
  });

  it("невідома категорія лишає загальний текст магазину", () => {
    // Старі продажі без рядків позицій: категорію взяти нізвідки.
    const text = composeWarrantyText({
      type: "sale",
      templateText: LEGACY_SALE_TEXT,
      saleCategories: [],
    });
    expect(text).toBe(LEGACY_SALE_TEXT);
  });

  it("власний текст магазину перекриває дефолт лише для своєї категорії", () => {
    const overrides = { accessory: "Обмін скла — 3 дні." };
    expect(saleWarrantyForCategory("accessory", overrides)).toBe("Обмін скла — 3 дні.");
    expect(saleWarrantyForCategory("device", overrides)).toBe(
      DEFAULT_SALE_WARRANTY_BY_CATEGORY.device,
    );
  });

  it("порожнє поле в налаштуваннях означає стандартний текст, а не порожній блок", () => {
    expect(saleWarrantyForCategory("part", { part: "   " })).toBe(
      DEFAULT_SALE_WARRANTY_BY_CATEGORY.part,
    );
  });

  it("продаж без гарантійної дати все одно друкує умови категорії", () => {
    const text = composeWarrantyText({ type: "sale", saleCategories: ["service"] });
    expect(text).toBe(DEFAULT_SALE_WARRANTY_BY_CATEGORY.service);
    expect(text).not.toContain("Гарантія дійсна до");
  });

  it("чеки ремонту категоріями продажу не зачіпаються", () => {
    const acceptance = composeWarrantyText({
      type: "repair_acceptance",
      usingFallbackTemplate: true,
      saleCategories: ["device"],
    });
    expect(acceptance).toContain("Безкоштовне зберігання");

    const warranty = composeWarrantyText({
      type: "repair_warranty",
      warrantyMonths: 3,
      saleCategories: ["device"],
    });
    expect(warranty).toContain("Термін гарантії: 3 міс.");
    expect(warranty).toContain("замінені деталі");
  });
});

describe("розшифровка суми гарантійного талона ремонту", () => {
  /* 350 — ціна для клієнта, а не собівартість: у чек іде те, що клієнт платить
     за деталь, інакше документ показував би закупівельну ціну магазину. */
  const DISPLAY = { name: "Дисплей", compatibleWith: "Redmi Note 10S", quantity: 1, unitPrice: 350 };

  it("без списаних деталей таблиці немає — опис робіт не дублюється", () => {
    // Саме цей випадок друкував «Переклейка дисплейного модулю» двічі: під
    // «ВИКОНАНІ РОБОТИ» і рядком таблиці на ту саму суму.
    expect(composeRepairBreakdown(500, [])).toEqual([]);
  });

  it("роботи називаються роботами, а не текстом виконаних робіт", () => {
    const lines = composeRepairBreakdown(500, [DISPLAY]);
    expect(lines[0]).toEqual({ name: "Ремонтні роботи", quantity: 1, unit_price: 150 });
  });

  it("сума рядків дорівнює ціні ремонту", () => {
    const lines = composeRepairBreakdown(500, [DISPLAY, { name: "Шлейф", quantity: 2, unitPrice: 40 }]);
    const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    expect(total).toBe(500);
  });

  it("деталь підписана сумісністю, коли вона відома", () => {
    const [, part] = composeRepairBreakdown(500, [DISPLAY]);
    expect(part.name).toBe("Дисплей (Redmi Note 10S)");
    expect(composeRepairBreakdown(500, [{ ...DISPLAY, compatibleWith: null }])[1].name).toBe("Дисплей");
  });

  it("ремонт у нуль по роботах показує лише деталі", () => {
    const lines = composeRepairBreakdown(350, [DISPLAY]);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit_price).toBe(350);
  });

  it("ремонт у мінус не друкує таблицю, яка суперечила б сумі чека", () => {
    expect(composeRepairBreakdown(300, [DISPLAY])).toEqual([]);
  });
});
