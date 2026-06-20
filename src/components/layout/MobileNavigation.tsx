"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { 
  IconGrid, IconRepair, IconDevice, IconMenu, IconClose, 
  IconAccessory, IconCustomer, IconFinance, IconReport, IconSettings, IconLogout, IconBox
} from "@/components/icons";

const mainItems = [
  { href: "/admin", label: "Дашборд", icon: <IconGrid /> },
  { href: "/admin/repairs", label: "Ремонти", icon: <IconRepair /> },
  { href: "/admin/devices", label: "Техніка", icon: <IconDevice /> },
];

const moreItems = [
  { href: "/admin/services", label: "Послуги", icon: <IconBox /> },
  { href: "/admin/accessories", label: "Аксесуари", icon: <IconAccessory /> },
  { href: "/admin/parts", label: "Запчастини", icon: <IconBox /> },
  { href: "/admin/suppliers", label: "Постачальники", icon: <IconCustomer /> },
  { href: "/admin/purchases", label: "Закупівлі", icon: <IconFinance /> },
  { href: "/admin/sales", label: "Продажі", icon: <IconFinance /> },
  { href: "/admin/customers", label: "Клієнти", icon: <IconCustomer /> },
  { href: "/admin/finance", label: "Фінанси", icon: <IconFinance /> },
  { href: "/admin/partners", label: "Партнери", icon: <IconCustomer /> },
  { href: "/admin/reports", label: "Звіти", icon: <IconReport /> },
  { href: "/admin/settings", label: "Налаштування", icon: <IconSettings /> },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="md:hidden fixed inset-0 z-40 bg-warm-sidebar flex flex-col pb-24 overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-warm-border bg-white/50 backdrop-blur-md sticky top-0 z-10">
              <h2 className="text-lg font-semibold text-text-primary">Меню</h2>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 rounded-full bg-warm-hover text-text-secondary"
              >
                <IconClose />
              </button>
            </div>
            
            <div className="p-4 space-y-2">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-warm-border text-text-primary shadow-sm active:scale-95 transition-transform"
                >
                  <span className="text-violet flex-shrink-0 w-6 h-6 flex items-center justify-center">{item.icon}</span>
                  <span className="font-medium text-sm">{item.label}</span>
                </Link>
              ))}
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 mt-4 rounded-xl bg-rose/10 text-rose font-medium text-sm active:scale-95 transition-transform"
              >
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center"><IconLogout /></span> 
                Вийти
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-warm-border pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="flex justify-around items-center h-16 px-2">
          {mainItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="relative flex flex-col items-center justify-center w-full h-full space-y-1"
              >
                {isActive && (
                  <motion.div
                    layoutId="bubble"
                    className="absolute inset-0 bg-violet-subtle rounded-xl m-1"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={`z-10 flex items-center justify-center w-6 h-6 transition-colors duration-200 ${isActive ? "text-violet" : "text-text-secondary"}`}>
                  {item.icon}
                </div>
                <span className={`z-10 text-[10px] font-medium transition-colors duration-200 ${isActive ? "text-violet" : "text-text-secondary"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="relative flex flex-col items-center justify-center w-full h-full space-y-1"
          >
            {isMenuOpen && (
              <motion.div
                layoutId="bubble"
                className="absolute inset-0 bg-violet-subtle rounded-xl m-1"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <div className={`z-10 flex items-center justify-center w-6 h-6 transition-colors duration-200 ${isMenuOpen ? "text-violet" : "text-text-secondary"}`}>
              <IconMenu />
            </div>
            <span className={`z-10 text-[10px] font-medium transition-colors duration-200 ${isMenuOpen ? "text-violet" : "text-text-secondary"}`}>
              Більше
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
