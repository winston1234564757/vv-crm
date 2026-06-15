"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  IconGrid, IconDevice, IconAccessory, IconRepair,
  IconCustomer, IconReport, IconFinance, IconLogo,
  IconMenu, IconClose, IconLogout, IconBox, IconSettings
} from "./icons";

// Unique semantic icons for each nav section
function IconSupplier({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M13 7H16L18 10V16H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="5.5" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="15.5" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconSale({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5C3 3.9 3.9 3 5 3H9.5L17 10.5L11.5 16L4 8.5V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="6.5" cy="6.5" r="1" fill="currentColor"/>
    </svg>
  );
}

function IconPurchase({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 3H5L6.5 12H14.5L16 6H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="13" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconPartner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="13" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 17C2 14 4 12 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M18 17C18 14 16 12 13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 17C9 14.5 10 13 10 13C10 13 11 14.5 11 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const navItems = [
  { href: "/admin",             label: "Дашборд",       icon: <IconGrid /> },
  { href: "/admin/devices",     label: "Техніка",       icon: <IconDevice /> },
  { href: "/admin/services",    label: "Послуги",       icon: <IconBox /> },
  { href: "/admin/accessories", label: "Аксесуари",     icon: <IconAccessory /> },
  { href: "/admin/parts",       label: "Запчастини",    icon: <IconRepair /> },
  { href: "/admin/suppliers",   label: "Постачальники", icon: <IconSupplier /> },
  { href: "/admin/purchases",   label: "Закупівлі",     icon: <IconPurchase /> },
  { href: "/admin/sales",       label: "Продажі",       icon: <IconSale /> },
  { href: "/admin/repairs",     label: "Ремонти",       icon: <IconRepair /> },
  { href: "/admin/customers",   label: "Клієнти",       icon: <IconCustomer /> },
  { href: "/admin/finance",     label: "Фінанси",       icon: <IconFinance /> },
  { href: "/admin/partners",    label: "Партнери",      icon: <IconPartner /> },
  { href: "/admin/reports",     label: "Звіти",         icon: <IconReport /> },
  { href: "/admin/settings",    label: "Налаштування",  icon: <IconSettings /> },
];

const roleLabels: Record<string, string> = {
  owner: "Власник",
  manager: "Менеджер",
  sales: "Продавець",
  technician: "Технік",
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("vlasnyk@vv-crm.com");
  const [userRole, setUserRole] = useState("Адміністратор");
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

        if (profile?.role) {
          setUserRole(roleLabels[profile.role] ?? profile.role);
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-3 px-6 border-b border-warm-border">
        <span className="text-violet"><IconLogo /></span>
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          {shopName}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-4 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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
            {userRole[0] ?? "А"}
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">{userRole}</p>
            <p className="text-xs text-text-secondary truncate max-w-[160px]" title={userEmail}>{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-press mt-3 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"
        >
          <IconLogout /> Вийти
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex inset-y-0 left-0 z-40 w-72 flex-col bg-warm-sidebar transition-[transform] duration-200 ease-out border-r border-warm-border">
        <SidebarContent />
      </aside>

      {/* Mobile: sticky top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-warm-surface border-b border-warm-border px-4">
        <div className="flex items-center gap-2">
          <span className="text-violet"><IconLogo size={20} /></span>
          <span className="text-base font-semibold tracking-tight text-text-primary">{shopName}</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="btn-press flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-warm-hover hover:text-text-primary"
          aria-label="Відкрити меню"
        >
          <IconMenu />
        </button>
      </div>

      {/* Mobile: full-screen overlay drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-warm-bg/80 backdrop-blur-sm"
              aria-hidden="true"
            />
            {/* Drawer panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-warm-sidebar border-r border-warm-border shadow-xl"
            >
              <div className="flex items-center justify-between h-16 px-6 border-b border-warm-border">
                <div className="flex items-center gap-3">
                  <span className="text-violet"><IconLogo /></span>
                  <span className="text-lg font-semibold tracking-tight text-text-primary">{shopName}</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="btn-press flex h-9 w-9 items-center justify-center rounded-full bg-violet/5 text-text-secondary transition-colors hover:bg-violet/10 hover:text-violet"
                  aria-label="Закрити меню"
                >
                  <IconClose />
                </button>
              </div>

              <nav className="flex-1 space-y-0.5 px-3 pt-4 overflow-y-auto">
                {navItems.map((item, i) => {
                  const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 ${
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
                    </motion.div>
                  );
                })}
              </nav>

              <div className="border-t border-warm-border px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-subtle text-xs font-semibold text-violet capitalize">
                    {userRole[0] ?? "А"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{userRole}</p>
                    <p className="text-xs text-text-secondary truncate max-w-[160px]" title={userEmail}>{userEmail}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-press mt-3 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-rose/5 hover:text-rose"
                >
                  <IconLogout /> Вийти
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
