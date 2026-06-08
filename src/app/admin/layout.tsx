"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function IconDevice() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconAccessory() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 4C11.5 4 13 5 13 7C13 9 10 11 10 13C10 11 7 9 7 7C7 5 8.5 4 10 4Z" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="10" y1="13" x2="10" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconRepair() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 3.5L16.5 5.5L12 10L10 8L14.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 8L7 5H3L5 7.5L8 10L10 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 10L16.5 14.5L14.5 16.5L10 12L12 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 10L5.5 12.5L7 16L10 12L8 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCustomer() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 18C4 14.5 6.5 12 10 12C13.5 12 16 14.5 16 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconReport() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="6" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function IconLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

const navItems = [
  { href: "/admin", label: "Дашборд", icon: <IconGrid /> },
  { href: "/admin/devices", label: "Товари", icon: <IconDevice /> },
  { href: "/admin/accessories", label: "Аксесуари", icon: <IconAccessory /> },
  { href: "/admin/repairs", label: "Ремонти", icon: <IconRepair /> },
  { href: "/admin/customers", label: "Клієнти", icon: <IconCustomer /> },
  { href: "/admin/reports", label: "Звіти", icon: <IconReport /> },
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
        {open ? <IconClose /> : <IconMenu />}
      </button>

      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-64 flex-col glass rounded-none border-r-0 shadow-[4px_0_32px_oklch(0%_0_0/0.04)] transition-transform duration-300 md:static md:translate-x-0`}
        style={{ backdropFilter: "blur(32px)" }}
      >
        <div className="flex h-16 items-center gap-3 px-6 border-b border-glass-border/50">
          <span className="text-violet"><IconLogo /></span>
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
                        background: "oklch(55% 0.22 290 / 0.1)",
                        boxShadow: "inset 3px 0 0 0 var(--color-violet)",
                      }
                    : undefined
                }
              >
                <span className="w-5 flex items-center justify-center">{item.icon}</span>
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
