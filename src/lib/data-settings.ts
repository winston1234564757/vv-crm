import { createClient } from "./supabase/server";
import type { Database } from "@/types/database";
import {
  DEFAULT_PRINTER_SETTINGS,
  type StoredPrinterSettings,
} from "@/lib/printer/receipt-escpos";
import type { SaleItemCategory, SaleWarrantyByCategory } from "@/lib/printer/receipt-content";

export interface SafeDistribution {
  opex: number;
  growth: number;
  net_profit: number;
}

export interface SalesTargets {
  /** Ціль по чистому прибутку за день. null = не задано. */
  daily: number | null;
  /** Ціль по чистому прибутку за місяць. null = не задано. */
  monthly: number | null;
}

export interface ReceiptTemplate {
  title: string;
  show_seller: boolean;
  show_buyer: boolean;
  /**
   * Для чеків ремонту — єдиний текст умов. Для продажу — запасний текст, який
   * друкується лише коли категорія проданого невідома: звичайний продаж бере
   * умови з `warranty_by_category`.
   */
  warranty_text: string;
  /**
   * Тільки для шаблону продажу. Порожнє поле або відсутній ключ = дефолт із
   * `DEFAULT_SALE_WARRANTY_BY_CATEGORY`.
   */
  warranty_by_category?: SaleWarrantyByCategory;
  show_qr: boolean;
}

/**
 * How to talk to the thermal printer: firmware facts, not tastes. The wrong
 * `codepage_index` prints Cyrillic as line-drawing characters and the wrong
 * `columns` silently wraps every line. They are stored per shop because they
 * differ by printer model and can only be found by printing the probe page at
 * /admin/settings/printer-probe.
 *
 * Defined in `lib/printer`, not here — this module imports the Supabase server
 * client, and the settings UI is a client component that needs the default
 * value at runtime.
 */
export type PrinterSettings = StoredPrinterSettings;

export interface ReceiptSettings {
  company_name: string;
  company_subtitle: string;
  address: string;
  phone: string;
  footer_text: string;
  templates: {
    sale: ReceiptTemplate;
    repair_acceptance: ReceiptTemplate;
    repair_warranty: ReceiptTemplate;
  };
  printer: PrinterSettings;
}


export interface ParsedSettings {
  shop_name: string;
  currency: string;
  distribution_tech: SafeDistribution;
  distribution_accessories: SafeDistribution;
  distribution_repairs: SafeDistribution;
  receipt_settings: ReceiptSettings;
  sales_targets: SalesTargets;
  /**
   * Момент, з якого рахуються гроші (ISO timestamp). До магазину справжнього
   * відкриття були тестові продажі "з рук" — вони лишаються в базі, але не
   * враховуються в жодному грошовому розрахунку. null = обмеження немає,
   * рахується вся історія (стара поведінка).
   */
  finance_epoch: string | null;
  /**
   * Категорія витрат, яка є одноразовим капіталом на відкриття, а не
   * операційною витратою — виключається з розрахунку операційного прибутку й
   * частки співвласника. null = виключення вимкнено.
   */
  capital_category_id: string | null;
}

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function parseDistribution(value: unknown): SafeDistribution {
  const fallback: SafeDistribution = { opex: 40, growth: 30, net_profit: 30 };
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return {
      opex: typeof obj.opex === "number" ? obj.opex : fallback.opex,
      growth: typeof obj.growth === "number" ? obj.growth : fallback.growth,
      net_profit: typeof obj.net_profit === "number" ? obj.net_profit : fallback.net_profit,
    };
  }
  return fallback;
}

/**
 * Ціль вимірюється прибутком, а не виторгом: виторг легко нагнати, продавши в
 * нуль. Дефолт — null, а не число: успадкована 15 000 ₴ була взята нізвідки, і
 * ціль, якої не ставили, краще не показувати взагалі.
 */
function parseSalesTargets(value: unknown): SalesTargets {
  const fallback: SalesTargets = { daily: null, monthly: null };
  if (typeof value !== "object" || value === null) return fallback;
  const obj = value as Record<string, unknown>;
  const one = (raw: unknown) =>
    typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
  return { daily: one(obj.daily), monthly: one(obj.monthly) };
}

/**
 * `finance_epoch` — рядок ISO timestamp, який `new Date(...)` вміє
 * розібрати. Порожній рядок і некоректна дата — це те саме, що відсутнє
 * налаштування: null, без обмеження.
 */
function parseFinanceEpoch(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

/**
 * `capital_category_id` — id категорії витрат, зарезервованої під
 * капітальні (одноразові, не операційні) витрати. Порожній рядок трактується
 * як відсутнє налаштування.
 */
function parseCapitalCategoryId(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function parseReceiptSettings(value: unknown, fallback: ReceiptSettings): ReceiptSettings {
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const templates = (obj.templates || {}) as Record<string, unknown>;
    
    const parseTemplate = (t: unknown, fb: ReceiptTemplate): ReceiptTemplate => {
      if (typeof t === "object" && t !== null) {
        const to = t as Record<string, unknown>;
        return {
          title: typeof to.title === "string" ? to.title : fb.title,
          show_seller: typeof to.show_seller === "boolean" ? to.show_seller : fb.show_seller,
          show_buyer: typeof to.show_buyer === "boolean" ? to.show_buyer : fb.show_buyer,
          warranty_text: typeof to.warranty_text === "string" ? to.warranty_text : fb.warranty_text,
          warranty_by_category: parseWarrantyByCategory(to.warranty_by_category),
          show_qr: typeof to.show_qr === "boolean" ? to.show_qr : fb.show_qr,
        };
      }
      return fb;
    };

    return {
      company_name: typeof obj.company_name === "string" ? obj.company_name : fallback.company_name,
      company_subtitle: typeof obj.company_subtitle === "string" ? obj.company_subtitle : fallback.company_subtitle,
      address: typeof obj.address === "string" ? obj.address : fallback.address,
      phone: typeof obj.phone === "string" ? obj.phone : fallback.phone,
      footer_text: typeof obj.footer_text === "string" ? obj.footer_text : fallback.footer_text,
      templates: {
        sale: parseTemplate(templates.sale, fallback.templates.sale),
        repair_acceptance: parseTemplate(templates.repair_acceptance, fallback.templates.repair_acceptance),
        repair_warranty: parseTemplate(templates.repair_warranty, fallback.templates.repair_warranty),
      },
      printer: parsePrinterSettings(obj.printer, fallback.printer),
    };
  }
  return fallback;
}

/**
 * Порожній рядок зберігається як «нема свого тексту» — тобто ключ просто не
 * потрапляє в результат, і рендер бере дефолт із `receipt-content.ts`. Так
 * очищене поле в налаштуваннях повертає стандартні умови, а не друкує порожній
 * блок гарантії.
 */
function parseWarrantyByCategory(value: unknown): SaleWarrantyByCategory | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  const categories: SaleItemCategory[] = ["device", "accessory", "part", "service"];
  const out: SaleWarrantyByCategory = {};
  for (const c of categories) {
    const raw = obj[c];
    if (typeof raw === "string" && raw.trim()) out[c] = raw.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Every field falls back individually rather than the block falling back as a
 * whole: rows saved before printer settings existed have no `printer` key at
 * all, and a receipt that will not print is a worse failure than one that
 * prints with a default margin.
 */
function parsePrinterSettings(value: unknown, fallback: PrinterSettings): PrinterSettings {
  if (typeof value !== "object" || value === null) return fallback;
  const obj = value as Record<string, unknown>;

  const int = (raw: unknown, min: number, max: number, fb: number) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return fb;
    return Math.min(max, Math.max(min, Math.round(raw)));
  };

  const codepage =
    obj.codepage === "cp1251" || obj.codepage === "cp866" || obj.codepage === "cp1125"
      ? obj.codepage
      : fallback.codepage;

  return {
    codepage_index: int(obj.codepage_index, 0, 255, fallback.codepage_index),
    codepage,
    columns: int(obj.columns, 16, 96, fallback.columns),
    qr_module_size: int(obj.qr_module_size, 1, 16, fallback.qr_module_size),
    feed_lines: int(obj.feed_lines, 0, 20, fallback.feed_lines),
    cut: typeof obj.cut === "boolean" ? obj.cut : fallback.cut,
  };
}

export async function getSettings(): Promise<ParsedSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*");
  if (error) throw error;

  const defaultSettings: ParsedSettings = {
    shop_name: "VV CRM",
    currency: "UAH",
    distribution_tech: { opex: 40, growth: 30, net_profit: 30 },
    distribution_accessories: { opex: 40, growth: 30, net_profit: 30 },
    distribution_repairs: { opex: 40, growth: 30, net_profit: 30 },
    sales_targets: { daily: null, monthly: null },
    finance_epoch: null,
    capital_category_id: null,
    receipt_settings: {
      company_name: "VV CRM",
      company_subtitle: "Магазин та сервісний центр",
      address: "м. Київ, вул. Хрещатик 1",
      phone: "+380 99 999 9999",
      footer_text: "Дякуємо за покупку! Чекаємо Вас знову!",
      templates: {
        sale: {
          title: "ТОВАРНИЙ ЧЕК",
          show_seller: true,
          show_buyer: true,
          /* Категорійно-нейтральний: друкується тільки коли категорія проданого
             невідома. Умови під конкретну категорію — у warranty_by_category. */
          warranty_text: "При виявленні несправностей протягом гарантійного строку товар приймається на діагностику за наявності цього чеку. Гарантія не поширюється на механічні пошкодження, сліди вологи та наслідки неправильної експлуатації.",
          show_qr: true
        },
        repair_acceptance: {
          title: "КВИТАНЦІЯ ПРИЙМАННЯ",
          show_seller: true,
          show_buyer: true,
          warranty_text: "1. Безкоштовне зберігання готового пристрою - до 14 днів.\n2. СЦ не несе відповідальності за збереження даних на пристрої.\n3. Пристрій приймається без гарантії на інші несправності.",
          show_qr: true
        },
        repair_warranty: {
          title: "ГАРАНТІЙНИЙ ТАЛОН РЕМОНТУ",
          show_seller: true,
          show_buyer: true,
          warranty_text: "Гарантія поширюється виключно на замінені деталі та виконані роботи. При виявленні слідів вологи, механічних пошкоджень або стороннього втручання гарантія анулюється.",
          show_qr: true
        }
      },
      printer: DEFAULT_PRINTER_SETTINGS
    }
  };

  const resolved = { ...defaultSettings };

  for (const s of data ?? []) {
    if (s.key === "shop_name" && typeof s.value === "string") {
      resolved.shop_name = s.value;
    } else if (s.key === "currency" && typeof s.value === "string") {
      resolved.currency = s.value;
    } else if (s.key === "distribution_tech") {
      resolved.distribution_tech = parseDistribution(s.value);
    } else if (s.key === "distribution_accessories") {
      resolved.distribution_accessories = parseDistribution(s.value);
    } else if (s.key === "distribution_repairs") {
      resolved.distribution_repairs = parseDistribution(s.value);
    } else if (s.key === "sales_targets") {
      resolved.sales_targets = parseSalesTargets(s.value);
    } else if (s.key === "finance_epoch") {
      resolved.finance_epoch = parseFinanceEpoch(s.value);
    } else if (s.key === "capital_category_id") {
      resolved.capital_category_id = parseCapitalCategoryId(s.value);
    } else if (s.key === "receipt_settings") {
      resolved.receipt_settings = parseReceiptSettings(s.value, defaultSettings.receipt_settings);
    }
  }

  return resolved;
}

export async function getProfiles(): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
    
  if (error) throw error;
  return data ?? [];
}
