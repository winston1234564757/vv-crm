"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { IconMenu, IconClose, IconLogout } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import {
  NAV_GROUPS,
  visibleGroups,
  getActiveGroup,
  isItemActive,
} from "@/lib/nav-config";

// Groups pinned to the bottom bar; the rest live in the "More" sheet.
const BOTTOM_IDS = ["dashboard", "work", "inventory", "sales"];

export default function MobileNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [rawRole, setRawRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role) setRawRole(profile.role);
    });
  }, []);

  const activeGroup = getActiveGroup(pathname);
  const bottomGroups = NAV_GROUPS.filter((g) => BOTTOM_IDS.includes(g.id));
  const sheetGroups = visibleGroups(rawRole).filter((g) => !BOTTOM_IDS.includes(g.id));

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
            className="md:hidden fixed inset-0 z-40 bg-bg flex flex-col pb-24 overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-surface sticky top-0 z-10">
              <h2 className="text-lg font-semibold text-ink tracking-tight font-display">Меню</h2>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 rounded-full bg-hover text-muted"
                aria-label="Закрити меню"
              >
                <IconClose />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {sheetGroups.map((group) => (
                <div key={group.id}>
                  <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-[var(--radius-lg)] border transition-colors active:scale-[0.98]",
                            active
                              ? "bg-accent-subtle border-transparent text-accent-ink"
                              : "bg-surface border-border text-ink",
                          )}
                        >
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-accent">
                            <Icon size={20} />
                          </span>
                          <span className="font-medium text-sm">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-lg)] bg-danger-subtle text-danger font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center"><IconLogout /></span>
                Вийти
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_oklch(0%_0_0/0.05)]">
        <div className="flex justify-around items-center h-16 px-1">
          {bottomGroups.map((group) => {
            const Icon = group.icon;
            const target = group.items[0].href;
            const isActive = !isMenuOpen && activeGroup?.id === group.id;
            return (
              <Link
                key={group.id}
                href={target}
                onClick={() => setIsMenuOpen(false)}
                className="relative flex flex-col items-center justify-center w-full h-full gap-1"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobilenav-bubble"
                    className="absolute inset-0 bg-accent-subtle rounded-[var(--radius-lg)] m-1"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className={cn("z-10 flex items-center justify-center w-6 h-6 transition-colors", isActive ? "text-accent-ink" : "text-muted")}>
                  <Icon size={22} />
                </span>
                <span className={cn("z-10 text-[10px] font-medium transition-colors", isActive ? "text-accent-ink" : "text-muted")}>
                  {group.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="relative flex flex-col items-center justify-center w-full h-full gap-1"
            aria-label="Більше"
          >
            {isMenuOpen && (
              <motion.div
                layoutId="mobilenav-bubble"
                className="absolute inset-0 bg-accent-subtle rounded-[var(--radius-lg)] m-1"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className={cn("z-10 flex items-center justify-center w-6 h-6 transition-colors", isMenuOpen ? "text-accent-ink" : "text-muted")}>
              <IconMenu />
            </span>
            <span className={cn("z-10 text-[10px] font-medium transition-colors", isMenuOpen ? "text-accent-ink" : "text-muted")}>
              Більше
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
