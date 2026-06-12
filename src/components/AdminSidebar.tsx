"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconGrid, IconDevice, IconAccessory, IconRepair, IconCustomer, IconReport, IconFinance, IconLogo, IconMenu, IconClose, IconLogout, IconBox, IconSettings } from "./icons";

const navItems = [
  { href: "/admin", label: "Дашборд", icon: <IconGrid /> },
  { href: "/admin/devices", label: "Техніка", icon: <IconDevice /> },
  { href: "/admin/services", label: "Послуги", icon: <IconBox /> },
  { href: "/admin/accessories", label: "Аксесуари", icon: <IconAccessory /> },
  { href: "/admin/parts", label: "Запчастини", icon: <IconBox /> },
  { href: "/admin/suppliers", label: "Постачальники", icon: <IconCustomer /> },
  { href: "/admin/purchases", label: "Закупівлі", icon: <IconFinance /> },
  { href: "/admin/repairs", label: "Ремонти", icon: <IconRepair /> },
  { href: "/admin/customers", label: "Клієнти", icon: <IconCustomer /> },
  { href: "/admin/finance", label: "Фінанси", icon: <IconFinance /> },
  { href: "/admin/partners", label: "Партнери", icon: <IconCustomer /> },
  { href: "/admin/reports", label: "Звіти", icon: <IconReport /> },
  { href: "/admin/settings", label: "Налаштування", icon: <IconSettings /> },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("vlasnyk@vv-crm.com");
  const [userRole, setUserRole] = useState("Власник");
  const [shopName, setShopName] = useState("VV CRM");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user && user.email) {
        setUserEmail(user.email);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
          
        const roleLabels: Record<string, string> = {
          owner: "Власник",
          manager: "Менеджер",
          sales: "Продавець",
          technician: "Технік",
        };
        
        if (profile?.role) {
          setUserRole(roleLabels[profile.role] || profile.role);
        } else {
          if (user.email === "viktor.koshel24@gmail.com") {
            setUserRole("Власник");
          } else if (user.email === "test_audit@vvcrm.ua") {
            setUserRole("Аудитор");
          } else {
            setUserRole("Адміністратор");
          }
        }
      }
    });

    supabase
      .from("settings")
      .select("value")
      .eq("key", "shop_name")
      .single()
      .then(({ data }) => {
        if (data && typeof data.value === "string") {
          setShopName(data.value);
        }
      });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="btn-press fixed top-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-text-secondary shadow-sm ring-1 ring-warm-border md:hidden"
        aria-label={open ? "Закрити меню" : "Відкрити меню"}
      >
        {open ? <IconClose /> : <IconMenu />}
      </button>

      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-72 max-w-[80vw] flex-col bg-warm-sidebar transition-[transform] duration-200 ease-out md:static md:translate-x-0`}
      >
        <div className="flex h-16 items-center gap-3 px-6 border-b border-warm-border">
          <span className="text-violet"><IconLogo /></span>
          <span className="text-lg font-semibold tracking-tight text-text-primary">
            {shopName}
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 pt-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2 ${
                  active
                    ? "bg-violet-subtle text-violet"
                    : "text-text-secondary hover:bg-warm-hover hover:text-text-primary"
                }`}
              >
                <span className="w-5 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-warm-border px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-subtle text-xs font-semibold text-violet capitalize">
              {userRole[0] || "А"}
            </span>
            <div>
              <p className="text-sm font-medium text-text-primary">{userRole}</p>
              <p className="text-xs text-text-secondary truncate max-w-[160px]" title={userEmail}>{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-press mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"
          >
            <IconLogout /> Вийти
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/10 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
