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
}

/**
 * Assemble the warranty / terms block.
 *
 * Note one inherited asymmetry, preserved deliberately rather than quietly
 * fixed: an acceptance receipt gets the three-point storage terms only when no
 * template was found. With a template present it shows that template's text
 * even when empty. Changing it would alter what existing receipts print, which
 * is a product decision and not part of moving this code.
 */
export function composeWarrantyText(params: WarrantyTextParams): string {
  const { type, templateText, warrantyEndFormatted, warrantyMonths, usingFallbackTemplate } =
    params;

  if (type === "sale" && warrantyEndFormatted) {
    const body = templateText || SALE_WARRANTY_FALLBACK;
    return `Гарантія дійсна до: ${warrantyEndFormatted}\n\n${body}`;
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
