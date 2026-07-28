"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getActiveGroup, isItemActive, visibleItems } from "@/lib/nav-config";
import type { UserRole } from "@/lib/roles";

/**
 * Route-based tab bar for grouped admin pages. Reads the current pathname,
 * finds its nav group and renders its sibling pages as tabs. Renders nothing
 * on standalone pages (Dashboard, Settings, Store launch) or unknown routes.
 *
 * `role` приходить пропом із серверного layout: вкладки мусять фільтруватись
 * так само, як сайдбар, інакше «Закупівлі» лишились би видимі в «Складі» тим,
 * кого сторінка все одно розверне.
 */
export default function SectionTabs({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const group = getActiveGroup(pathname);

  if (!group) return null;

  const items = visibleItems(group, role);

  if (group.standalone || items.length < 2) return null;

  return (
    <div className="mb-5 -mx-4 md:mx-0 px-4 md:px-0 border-b border-border">
      <div
        role="tablist"
        aria-label={group.label}
        className="flex items-center gap-1 overflow-x-auto"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
                active
                  ? "border-accent text-accent-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <span className="shrink-0"><Icon size={16} /></span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
