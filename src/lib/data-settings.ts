import { createClient } from "./supabase/server";
import type { Database } from "@/types/database";

export interface SafeDistribution {
  opex: number;
  growth: number;
  net_profit: number;
}

export interface ReceiptTemplate {
  title: string;
  show_seller: boolean;
  show_buyer: boolean;
  warranty_text: string;
  show_qr: boolean;
}

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
}

export interface ParsedSettings {
  shop_name: string;
  currency: string;
  distribution_tech: SafeDistribution;
  distribution_accessories: SafeDistribution;
  distribution_repairs: SafeDistribution;
  receipt_settings: ReceiptSettings;
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
      }
    };
  }
  return fallback;
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
          warranty_text: "При виявленні несправностей протягом гарантійного періоду товар приймається на діагностику за наявності цього чеку та оригінальної упаковки. Гарантія анулюється при виявленні слідів механічних пошкоджень, вологи або самостійного розкриття пристрою.",
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
      }
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
