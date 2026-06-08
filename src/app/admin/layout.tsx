"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/admin", label: "Дашборд", icon: "◈" },
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
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded bg-selvedge text-lg text-cream md:hidden"
        aria-label="Меню"
      >
        {open ? "✕" : "☰"}
      </button>

      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-selvedge transition-transform duration-300 ease-out-quart md:static md:translate-x-0`}
      >
        <div className="flex h-16 items-center gap-3 px-6 bench-edge" style={{ borderBottomColor: "oklch(40% 0.05 260 / 0.5)" }}>
          <span className="text-xl leading-none text-amber">◈</span>
          <span className="text-lg font-semibold tracking-tight text-cream">
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
                className={`flex items-center gap-3 rounded-sm px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-selvedge-deep text-amber"
                    : "text-selvedge-dim hover:bg-selvedge-deep/50 hover:text-cream"
                }`}
                style={
                  active
                    ? { boxShadow: "inset 2px 0 0 0 var(--color-amber)" }
                    : undefined
                }
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 bench-edge" style={{ borderTopColor: "oklch(40% 0.05 260 / 0.5)" }}>
          <div className="flex items-center gap-3 text-sm text-selvedge-dim">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-selvedge-deep text-xs text-cream">
              В
            </span>
            <span className="text-cream/70">Власник</span>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-iron/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="flex-1">{children}</main>
    </div>
  );
}
