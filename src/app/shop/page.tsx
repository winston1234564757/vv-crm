export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { IconLogo, IconRepair } from "@/components/icons";
import { ShopContent } from "./ShopContent";

async function getShopData() {
  const supabase = createAdminClient();
  const [devicesRes, accessoriesRes, servicesRes] = await Promise.all([
    supabase.from("devices").select("*").eq("is_visible", true).eq("status", "in_stock"),
    supabase.from("accessories").select("*").eq("is_visible", true).eq("status", "active"),
    supabase.from("services").select("*").eq("is_visible", true).eq("status", "active"),
  ]);
  return {
    devices: devicesRes.data ?? [],
    accessories: accessoriesRes.data ?? [],
    services: servicesRes.data ?? [],
  };
}

export default async function ShopPage() {
  const { devices, accessories, services } = await getShopData();

  return (
    <div className="min-h-screen bg-warm-bg">
      <header className="border-b border-warm-border/50 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/shop" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-text-primary">
            <span className="text-violet"><IconLogo /></span>
            VV CRM
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/track" className="flex items-center gap-1.5 rounded-xl border border-violet/20 px-4 py-2 text-sm font-medium text-violet transition-colors hover:bg-violet/5">
              <IconRepair /> Статус ремонту
            </Link>
            <Link href="/login" className="rounded-xl bg-violet px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-hover">
              Адмінка
            </Link>
          </div>
        </div>
      </header>

      <ShopContent devices={devices} accessories={accessories} services={services} />

      <footer className="border-t border-warm-border/50 py-8 text-center text-xs text-text-secondary">
        © 2026 VV CRM — Майстерня ремонту та продажу техніки
      </footer>
    </div>
  );
}
