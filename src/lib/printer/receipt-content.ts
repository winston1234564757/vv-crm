/**
 * What a receipt says, independent of how it is drawn.
 *
 * This logic used to live inside `ReceiptPrintModal`, which meant the on-screen
 * preview was the only thing that could produce it. Printing the same receipt
 * over ESC/POS would have needed a second copy of the fallback titles, the
 * condition labels and the warranty assembly — two definitions of the same
 * document, free to drift apart until paper and screen disagreed about what was
 * sold. One source, two renderers.
 */

export type ReceiptType = "sale" | "repair_acceptance" | "repair_warranty" | "order";

/** Used when the stored template has no title of its own. */
export function getFallbackTitle(type: ReceiptType): string {
  if (type === "sale") return "ТОВАРНИЙ ЧЕК";
  if (type === "repair_acceptance") return "КВИТАНЦІЯ ПРИЙМАННЯ";
  if (type === "order") return "БЛАНК ЗАМОВЛЕННЯ";
  return "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ";
}

/** The person named on the document differs by document. */
export function getPartyLabel(type: ReceiptType): string {
  if (type === "repair_acceptance") return "Прийняв";
  if (type === "repair_warranty") return "Видав";
  if (type === "order") return "Оформив";
  return "Продавець";
}

export function getCounterpartyLabel(type: ReceiptType): string {
  return type === "sale" ? "ПОКУПЕЦЬ" : "ЗАМОВНИК";
}

const CONDITION_LABELS: Record<string, string> = {
  perfect: "Grade A (Ідеальний)",
  good: "Grade B (Хороший)",
  fair: "Grade C (Середній)",
  poor: "Поганий",
  damaged: "Пошкоджений",
};

/** Unknown codes pass through unchanged — better a raw code than a blank. */
export function getConditionLabel(condition: string | null | undefined): string {
  if (!condition) return "Не вказано";
  return CONDITION_LABELS[condition] ?? condition;
}

const SALE_WARRANTY_FALLBACK =
  "При виявленні несправностей протягом гарантійного терміну товар приймається на діагностику за наявності цього чеку.";

/** Категорія позиції продажу — те саме, що `sale_items.item_type`. */
export type SaleItemCategory = "device" | "accessory" | "part" | "service";

/** Підписи блоків у змішаному чеку. */
const SALE_CATEGORY_LABELS: Record<SaleItemCategory, string> = {
  device: "Техніка",
  accessory: "Аксесуари",
  part: "Запчастини",
  service: "Послуги",
};

const SALE_CATEGORY_ORDER: SaleItemCategory[] = ["device", "accessory", "part", "service"];

/**
 * Умови гарантії окремо на кожну категорію товару.
 *
 * Один спільний текст на весь магазин був написаний під пристрої — і на чеку за
 * захисне скло обіцяв діагностику та погрожував анулюванням «при самостійному
 * розкритті пристрою». Скло не розкривають. Категорія позиції вже є в
 * `sale_items.item_type`, тож чек може сказати саме те, що стосується проданого.
 *
 * Це дефолти: власник магазину може перезаписати кожен з них у Налаштуваннях →
 * Чеки, а перед друком — ще й вручну в самому вікні друку.
 */
export const DEFAULT_SALE_WARRANTY_BY_CATEGORY: Record<SaleItemCategory, string> = {
  device:
    "Гарантія поширюється на заводські дефекти пристрою. Звернення приймається за наявності цього чеку. Гарантія анулюється при виявленні слідів вологи, механічних пошкоджень або самостійного розкриття пристрою.",
  accessory:
    "Гарантія поширюється лише на заводський брак. Захисне скло та плівка: претензії приймаються до моменту наклеювання — сколи й тріщини після встановлення не є гарантійним випадком. Обмін товару належного вигляду з упаковкою — 14 днів.",
  part:
    "Гарантія на запчастину діє за умови її встановлення в нашому сервісному центрі. При самостійному монтажі гарантія не надається. Комплектність і зовнішній вигляд перевіряються при купівлі.",
  service:
    "Гарантія поширюється на виконані роботи. Вона не діє при механічних пошкодженнях, потраплянні вологи або втручанні третіх осіб після надання послуги.",
};

/** Збережені в налаштуваннях заміни дефолтів. Порожній рядок = дефолт. */
export type SaleWarrantyByCategory = Partial<Record<SaleItemCategory, string>>;

export function saleWarrantyForCategory(
  category: SaleItemCategory,
  overrides?: SaleWarrantyByCategory,
): string {
  const custom = overrides?.[category];
  return custom && custom.trim() ? custom.trim() : DEFAULT_SALE_WARRANTY_BY_CATEGORY[category];
}

/**
 * Текст гарантії під конкретний набір категорій у чеку.
 *
 * Одна категорія — просто її умови, без зайвого підпису. Кілька — блок на
 * кожну, підписаний категорією, у сталому порядку (техніка → аксесуари →
 * запчастини → послуги), а не в порядку додавання в кошик: чек має читатися
 * однаково незалежно від того, що касир пробив першим.
 *
 * Порожній результат означає «категорії невідомі» (старий продаж без позицій,
 * швидкий продаж без вибраної категорії) — тоді викликач бере загальний текст.
 */
export function composeSaleWarrantyBody(
  categories: SaleItemCategory[] | undefined,
  overrides?: SaleWarrantyByCategory,
): string {
  if (!categories || categories.length === 0) return "";

  const present = SALE_CATEGORY_ORDER.filter((c) => categories.includes(c));
  if (present.length === 0) return "";
  if (present.length === 1) return saleWarrantyForCategory(present[0], overrides);

  return present
    .map((c) => `${SALE_CATEGORY_LABELS[c]}: ${saleWarrantyForCategory(c, overrides)}`)
    .join("\n\n");
}

/** Списана на ремонт деталь — те, що бачить `repair_parts` у картці ремонту. */
export interface RepairPartLine {
  name: string;
  compatibleWith?: string | null;
  quantity: number;
  /** Ціна для клієнта, а не собівартість: чек — документ для клієнта. */
  unitPrice: number;
}

/**
 * Послуга/робота, додана через `repair_services`.
 *
 * На відміну від запчастин, послуги вже мають конкретну назву й ціну —
 * вони потрапляють у чек як окремі рядки замість загального «Ремонтні роботи».
 */
export interface RepairServiceLine {
  name: string;
  quantity: number;
  unitPrice: number;
}

/** Рядок таблиці «ДЕТАЛІ ТА РОБОТИ» у формі, яку чекає чек. */
export interface RepairBreakdownLine {
  name: string;
  quantity: number;
  unit_price: number;
}

/**
 * Розшифровка суми гарантійного талона ремонту.
 *
 * Порожній результат означає «таблиці не буде» — чек друкує один рядок
 * «до сплати». Так виходить у двох випадках, і обидва навмисні:
 *
 * 1. Ні деталей, ні послуг не списували. Розшифровувати 500 ₴ у єдиний рядок
 *    на 500 ₴ немає чого. Раніше цей рядок ще й називався текстом виконаних
 *    робіт, тож той самий опис друкувався двічі поспіль — під «ВИКОНАНІ
 *    РОБОТИ» і в таблиці.
 * 2. Деталі + послуги коштують для клієнта більше за ціну ремонту. Звести
 *    таблицю неможливо, а «РАЗОМ» у ній розійшлося б із сумою, яку клієнт
 *    заплатив.
 *
 * Якщо `services` передано — кожна послуга виходить окремим рядком замість
 * загального «Ремонтні роботи». Якщо послуг немає — стара поведінка: залишок
 * ціни після деталей іде рядком «Ремонтні роботи».
 *
 * Сума всіх рядків завжди дорівнює ціні ремонту.
 */
export function composeRepairBreakdown(
  price: number,
  parts: RepairPartLine[],
  services: RepairServiceLine[] = [],
): RepairBreakdownLine[] {
  if (parts.length === 0 && services.length === 0) return [];

  const lines: RepairBreakdownLine[] = [];

  if (services.length > 0) {
    // Явно додані послуги — завжди показуємо як окремі рядки.
    // Перевірка «labor < 0» тут не застосовується: майстер сам визначив
    // перелік і вартість, ми просто відображаємо що він додав.
    for (const s of services) {
      if (s.unitPrice <= 0) continue;
      lines.push({ name: s.name, quantity: s.quantity, unit_price: s.unitPrice });
    }
    for (const p of parts) {
      if (p.unitPrice <= 0) continue;
      lines.push({
        name: p.compatibleWith ? `${p.name} (${p.compatibleWith})` : p.name,
        quantity: p.quantity,
        unit_price: p.unitPrice,
      });
    }
    return lines;
  }

  // Послуг немає — стара поведінка: залишок ціни = «Ремонтні роботи».
  const partsTotal = parts.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
  const labor = price - partsTotal;
  if (labor < 0) return [];

  if (labor > 0) lines.push({ name: "Ремонтні роботи", quantity: 1, unit_price: labor });
  for (const p of parts) {
    if (p.unitPrice <= 0) continue;
    lines.push({
      name: p.compatibleWith ? `${p.name} (${p.compatibleWith})` : p.name,
      quantity: p.quantity,
      unit_price: p.unitPrice,
    });
  }
  return lines;
}

const REPAIR_WARRANTY_FALLBACK =
  "Гарантія поширюється виключно на замінені деталі та виконані роботи.";

const ACCEPTANCE_TERMS_FALLBACK =
  "1. Безкоштовне зберігання готового пристрою - до 14 днів.\n" +
  "2. СЦ не несе відповідальності за збереження даних.\n" +
  "3. Пристрій приймається без гарантії на інші несправності.";

const ORDER_TERMS_FALLBACK =
  "1. Замовлення виконується у погоджений термін.\n" +
  "2. Аванс за індивідуальне замовлення не повертається у разі відмови.\n" +
  "3. Товар зберігається до 14 днів після надходження.";

export interface WarrantyTextParams {
  type: ReceiptType;
  /** `warranty_text` from the stored template, if a template exists at all. */
  templateText?: string;
  /** Formatted date, e.g. "21.07.2026". Sales only. */
  warrantyEndFormatted?: string | null;
  /** Repair warranty term in months. */
  warrantyMonths?: number;
  /** True when no stored template was found and defaults must fill in. */
  usingFallbackTemplate?: boolean;
  /** Категорії проданих позицій. Тільки для `sale`. */
  saleCategories?: SaleItemCategory[];
  /** Тексти по категоріях з налаштувань магазину. Тільки для `sale`. */
  saleWarrantyByCategory?: SaleWarrantyByCategory;
}

/**
 * Assemble the warranty / terms block.
 *
 * Умови продажу беруться з категорій проданих позицій; збережений у
 * налаштуваннях загальний текст лишається запасним варіантом на випадок, коли
 * категорії невідомі — старі продажі без рядків позицій і швидкий продаж без
 * вибраної категорії.
 *
 * Note one inherited asymmetry, preserved deliberately rather than quietly
 * fixed: an acceptance receipt gets the three-point storage terms only when no
 * template was found. With a template present it shows that template's text
 * even when empty. Changing it would alter what existing receipts print, which
 * is a product decision and not part of moving this code.
 */
export function composeWarrantyText(params: WarrantyTextParams): string {
  const {
    type,
    templateText,
    warrantyEndFormatted,
    warrantyMonths,
    usingFallbackTemplate,
    saleCategories,
    saleWarrantyByCategory,
  } = params;

  if (type === "sale") {
    const byCategory = composeSaleWarrantyBody(saleCategories, saleWarrantyByCategory);
    const body = byCategory || templateText || SALE_WARRANTY_FALLBACK;
    return warrantyEndFormatted ? `Гарантія дійсна до: ${warrantyEndFormatted}\n\n${body}` : body;
  }

  if (type === "repair_warranty" && warrantyMonths) {
    const body = templateText || REPAIR_WARRANTY_FALLBACK;
    return `Термін гарантії: ${warrantyMonths} міс.\n\n${body}`;
  }

  if (type === "repair_acceptance" && usingFallbackTemplate) {
    return ACCEPTANCE_TERMS_FALLBACK;
  }

  if (type === "order") {
    return templateText || ORDER_TERMS_FALLBACK;
  }

  if (type === "repair_warranty" && usingFallbackTemplate) {
    return `Термін гарантії: ${warrantyMonths || 0} міс.\n\n${REPAIR_WARRANTY_FALLBACK}`;
  }

  return templateText || "";
}

/** Heading above the warranty block. */
export function getWarrantyHeading(type: ReceiptType): string {
  if (type === "repair_acceptance") return "УМОВИ РЕМОНТУ";
  if (type === "order") return "УМОВИ ЗАМОВЛЕННЯ";
  return "ГАРАНТІЙНІ ЗОБОВ'ЯЗАННЯ";
}

/** Signature lines, in print order. Disabled per requirements. */
export function getSignatureLabels(type: ReceiptType): string[] {
  return [];
}
