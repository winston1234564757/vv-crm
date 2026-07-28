/**
 * Розраховує ціну з урахуванням знижки та округлює до найближчого цілого
 */
export function calculateDiscountedPrice(price: number, discountPercent: number): number {
  if (price < 0) return 0;
  const pct = Math.max(0, Math.min(100, discountPercent));
  return Math.round(price * (1 - pct / 100));
}

/**
 * Розраховує залишок суми до розподілу для спліт-оплати (готівка + карта)
 */
export function calculateRemainingSplit(total: number, cash: number, card: number): number {
  const t = total;
  const c = cash;
  const cr = card;
  
  // Використовуємо parseFloat та toFixed для запобігання проблемам з точністю float у JS (хоча тут ми працюємо з цілими числами, краще перестрахуватись)
  const remaining = t - c - cr;
  return Math.round(remaining * 100) / 100;
}

/**
 * Валідація ціни - має бути невід'ємним числом
 */
export function validatePrice(price: unknown): number {
  const num = Number(price);
  if (isNaN(num) || num < 0) {
    throw new Error("Ціна має бути невід'ємним числом");
  }
  return num;
}

/**
 * Валідація кількості товару - має бути цілим невід'ємним числом
 */
export function validateStock(stock: unknown): number {
  const num = Number(stock);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error("Кількість товару має бути цілим невід'ємним числом");
  }
  return num;
}

/**
 * Валідація URL фотографій - має бути дійсним URL або порожнім рядком
 */
export function validatePhotoUrl(url: unknown): string {
  if (!url || typeof url !== 'string') {
    throw new Error("URL фотографії має бути валідним рядком");
  }
  const trimmed = url.trim();
  if (trimmed) {
    try {
      new URL(trimmed);
    } catch {
      throw new Error("Невалідний формат URL фотографії");
    }
  }
  return trimmed;
}

/**
 * Валідація частин - має містити назву та невід'ємну ціну
 */
export function validatePart(part: unknown): { name: string; cost: number; origin: string } {
  if (!part || typeof part !== 'object') {
    throw new Error("Дані частини повинні бути об'єктом");
  }
  const p = part as Record<string, unknown>;
  if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
    throw new Error("Назва частини обов'язкова та не може бути порожньою");
  }
  const cost = Number(p.cost);
  if (isNaN(cost) || cost < 0) {
    throw new Error("Вартість частини має бути невід'ємним числом");
  }
  if (!p.origin || typeof p.origin !== 'string') {
    throw new Error("Походження частини обов'язкове");
  }
  return {
    name: p.name.trim() as string,
    cost,
    origin: p.origin as string
  };
}

/**
 * Валідація частини з колекції складу
 */
export function validateWarehousePart(part: unknown): { id: string; name: string; cost_price: number; origin_type: string; stock: number } {
  if (!part || typeof part !== 'object') {
    throw new Error("Дані частини зі складу повинні бути об'єктом");
  }
  const p = part as Record<string, unknown>;
  if (!p.id || typeof p.id !== 'string') {
    throw new Error("ID частини обов'язкове");
  }
  if (!p.name || typeof p.name !== 'string') {
    throw new Error("Назва частини обов'язкова");
  }
  const cost = Number(p.cost_price);
  if (isNaN(cost) || cost < 0) {
    throw new Error("Вартість частини має бути невід'ємним числом");
  }
  if (!p.origin_type || typeof p.origin_type !== 'string') {
    throw new Error("Тип походження частини обов'язковий");
  }
  const stock = Number(p.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("Кількість товару на складі має бути цілим невід'ємним числом");
  }
  return {
    id: p.id as string,
    name: p.name as string,
    cost_price: cost,
    origin_type: p.origin_type as string,
    stock
  };
}

/**
 * Валідація знижки - має бути числом від 0 до 100
 */
export function validateDiscount(discount: unknown): number {
  const num = Number(discount);
  if (isNaN(num) || num < 0 || num > 100) {
    throw new Error("Знижка має бути числом від 0 до 100");
  }
  return num;
}

/**
 * Валідація комбінації готівки та карти для спліт-оплати
 */
export function validateSplitPayment(total: number, cash: unknown, card: unknown): { cash: number; card: number } {
  const cashNum = Number(cash);
  const cardNum = Number(card);

  if (isNaN(cashNum) || cashNum < 0) {
    throw new Error("Сума готівки має бути невід'ємним числом");
  }
  if (isNaN(cardNum) || cardNum < 0) {
    throw new Error("Сума по карті має бути невід'ємним числом");
  }
  if (cashNum + cardNum > total) {
    throw new Error("Сума спліт-оплати не може перевищувати загальну суму");
  }

  return { cash: cashNum, card: cardNum };
}

/**
 * Тип рядка `cash_registers`, який означає безготівковий рахунок.
 *
 * Безготівка — це не каса: фізично цих грошей у шухляді немає. Але окрема
 * таблиця коштувала б третього виду сховища в кожному шляху читання, тож
 * рахунок живе поруч із касами й відрізняється саме типом.
 */
export const CASHLESS_REGISTER_TYPE = "cashless";

export function isCashless(type: string): boolean {
  return type === CASHLESS_REGISTER_TYPE;
}

/**
 * Ділить баланси контейнерів на готівку й безготівку.
 *
 * Живе тут, а не чотирма копіями в дашборді, фінансах і AI-роуті: у цьому
 * проєкті вже є слід від скопійованого правила — `EARNED_REPAIR_STATUSES`
 * колись розійшовся по незалежних копіях і почав означати різне.
 */
export function splitByKind<T extends { type: string; balance: number }>(
  registers: T[],
): { cash: number; cashless: number; total: number } {
  let cash = 0;
  let cashless = 0;
  for (const r of registers) {
    if (isCashless(r.type)) cashless += r.balance;
    else cash += r.balance;
  }
  return { cash, cashless, total: cash + cashless };
}

/**
 * У який тип каси має лягти платіж.
 *
 * Метод важливіший за категорію: категорія обирає касу лише тоді, коли гроші
 * справді готівкові. Усе інше — картка, переказ, невідоме — їде на безготівку,
 * бо в шухляду воно не потрапляє.
 */
export function targetRegisterType(
  method: string,
  category: "device" | "accessory" | "service",
): string {
  if (method !== "cash") return CASHLESS_REGISTER_TYPE;
  if (category === "accessory") return "accessories";
  if (category === "service") return "repairs";
  return "tech";
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Готівка",
  card: "Картка",
  transfer: "Переказ",
};

/**
 * Підпис способу оплати для чека. Чек буває зі сплітом, тож методів може
 * бути кілька — тоді підписи зводяться в один без повторів.
 *
 * Три підписи, а не два, хоча маршрутизація грошей бінарна. Це різні питання:
 * `targetRegisterType` вирішує, в яку касу лягти, і переказ там справедливо
 * дорівнює картці — у шухляду не потрапляє ні той, ні та. Але «чим заплатив
 * клієнт» решта застосунку показує трьома значеннями (`domain-labels`,
 * картка продажу, фільтр у тій самій таблиці), і зведення переказу до
 * «Картки» зробило б колонку єдиним місцем, що суперечить сусіднім.
 */
export function paymentMethodLabel(payments: { method: string }[]): string {
  if (payments.length === 0) return "—";
  const kinds = new Set(payments.map((p) => METHOD_LABELS[p.method] ?? "Інше"));
  return [...kinds].join(" + ");
}
