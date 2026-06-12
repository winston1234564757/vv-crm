import { createClient } from "./supabase/server";
import type { Database } from "@/types/database";

export interface SafeDistribution {
  opex: number;
  growth: number;
  net_profit: number;
}

export interface ParsedSettings {
  shop_name: string;
  currency: string;
  distribution_tech: SafeDistribution;
  distribution_accessories: SafeDistribution;
  distribution_repairs: SafeDistribution;
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
