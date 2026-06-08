"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/admin", label: "Дашборд", icon: "◆" },
  { href: "/admin/devices", label: "Товари", icon: "◇" },
  { href: "/admin/accessories", label: "Аксесуари", icon: "○" },
  { href: "/admin/repairs", label: "Ремонти", icon: "◎" },
  { href: "/admin/customers", label: "Клієнти", icon: "□" },
  { href: "/admin/reports", label: "Звіти", icon: "▤" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 flex h-11 w-11 items-center justify-center rounded-xl glass text-indigo shadow-lg md:hidden"
        aria-label="Меню"
      >
        {open ? "✕" : "☰"}
      </button>

      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-64 flex-col glass rounded-none border-r-0 shadow-[4px_0_32px_oklch(0%_0_0/0.04)] transition-transform duration-300 md:static md:translate-x-0`}
        style={{ backdropFilter: "blur(32px)" }}
      >
        <div className="flex h-16 items-center gap-3 px-6 border-b border-glass-border/50">
          <span className="text-xl leading-none text-violet">◆</span>
          <span className="text-lg font-semibold tracking-tight text-indigo">
            VV CRM
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
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
                  active
                    ? "text-violet"
                    : "text-iris hover:text-indigo hover:bg-violet/5"
                }`}
                style={
                  active
                    ? {
                        background:
                          "oklch(55% 0.22 290 / 0.1)",
                        boxShadow:
                          "inset 3px 0 0 0 var(--color-violet)",
                      }
                    : undefined
                }
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-glass-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet/10 text-xs font-semibold text-violet">
              В
            </span>
            <div>
              <p className="text-sm font-medium text-indigo">Власник</p>
              <p className="text-xs text-iris">vlasnyk@vv-crm.com</p>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-iris/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
