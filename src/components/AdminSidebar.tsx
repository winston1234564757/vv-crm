"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconLogo, IconLogout, IconChevron } from "./icons";
import { cn } from "@/lib/utils/cn";
import {
  visibleGroups,
  isItemActive,
  getActiveGroup,
  type NavGroup,
} from "@/lib/nav-config";
import type { UserRole } from "@/lib/roles";

const roleLabels: Record<string, string> = {
  owner: "Власник",
  manager: "Менеджер",
  sales: "Продавець",
  technician: "Технік",
};

export default function AdminSidebar({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("vlasnyk@vv-crm.com");
  const [shopName, setShopName] = useState("VV CRM");

  const userRole = role ? roleLabels[role] ?? role : "—";

  const activeGroup = getActiveGroup(pathname);
  const [openId, setOpenId] = useState<string | null>(activeGroup?.id ?? null);

  // Keep the active group expanded as the user navigates.
  useEffect(() => {
    if (activeGroup && !activeGroup.standalone) setOpenId(activeGroup.id);
  }, [activeGroup]);

  // Роль сюди більше не тягнеться — вона приходить пропом із layout. Лишились
  // пошта користувача й назва магазину, які на видимість нічого не впливають.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });

    supabase
      .from("settings")
      .select("value")
      .eq("key", "shop_name")
      .single()
      .then(({ data }) => {
        if (data && typeof data.value === "string") setShopName(data.value);
      });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const groups = visibleGroups(role);

  function handleGroupClick(group: NavGroup) {
    setOpenId(group.id);
    router.push(group.items[0].href);
  }

  const SidebarContent = () => (
    <>
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border">
        <span className="text-accent"><IconLogo /></span>
        <span className="text-lg font-semibold tracking-tight text-ink font-display">
          {shopName}
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 pt-4 overflow-y-auto">
        {groups.map((group) => {
          const isActiveGroup = activeGroup?.id === group.id;

          // Standalone groups (Dashboard, Settings, Store launch) — a single link.
          if (group.standalone) {
            const item = group.items[0];
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href);
            return (
              <Link
                key={group.id}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                  active
                    ? "bg-accent-subtle text-accent-ink"
                    : "text-muted hover:bg-hover hover:text-ink",
                )}
              >
                <span className="w-5 flex items-center justify-center shrink-0">
                  <Icon size={20} />
                </span>
                {group.label}
              </Link>
            );
          }

          // Grouped section — header toggles expansion + navigates to first item.
          const GroupIcon = group.icon;
          const open = openId === group.id;
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => handleGroupClick(group)}
                aria-expanded={open}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                  isActiveGroup
                    ? "text-ink font-semibold"
                    : "text-muted hover:bg-hover hover:text-ink font-medium",
                )}
              >
                <span className="w-5 flex items-center justify-center shrink-0">
                  <GroupIcon size={20} />
                </span>
                <span className="flex-1 text-left">{group.label}</span>
                <IconChevron
                  size={14}
                  className={cn(
                    "shrink-0 text-faint transition-transform duration-200",
                    open ? "rotate-90" : "",
                  )}
                />
              </button>

              {open && (
                <div className="mt-0.5 space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const active = isItemActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-[var(--radius-md)] py-2 pl-11 pr-3 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                          active
                            ? "bg-accent-subtle text-accent-ink font-medium"
                            : "text-muted hover:bg-hover hover:text-ink",
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent-ink capitalize">
            {userRole[0] ?? "А"}
          </span>
          <div>
            <p className="text-sm font-medium text-ink">{userRole}</p>
            <p className="text-xs text-muted truncate max-w-[160px]" title={userEmail}>{userEmail}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-press mt-3 flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-danger-subtle hover:text-danger"
        >
          <IconLogout /> Вийти
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex inset-y-0 left-0 z-40 w-72 flex-col bg-sidebar border-r border-border">
        {SidebarContent()}
      </aside>

      {/* Mobile: sticky top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between bg-surface border-b border-border px-4">
        <div className="flex items-center gap-2">
          <span className="text-accent"><IconLogo size={20} /></span>
          <span className="text-base font-semibold tracking-tight text-ink font-display">{shopName}</span>
        </div>
      </div>
    </>
  );
}
