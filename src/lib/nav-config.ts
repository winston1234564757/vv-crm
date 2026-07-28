import type { ComponentType } from "react";
import { MONEY_ROLES, type UserRole } from "@/lib/roles";
import {
  IconGrid,
  IconRepair,
  IconParts,
  IconService,
  IconDevice,
  IconAccessory,
  IconSupplier,
  IconPurchase,
  IconSale,
  IconCustomer,
  IconPartner,
  IconFinance,
  IconReport,
  IconSettings,
  IconRocket,
} from "@/components/icons";

export type IconComponent = ComponentType<{ size?: number; className?: string }>;

export interface NavItem {
  href: string;
  label: string;
  icon: IconComponent;
  /**
   * Roles allowed to see this page. Omitted means everyone.
   *
   * Потрібен там, де обмежена окрема сторінка, а не вся група: «Закупівлі»
   * стоять у «Складі» поруч із технікою й запчастинами, які потрібні всім.
   */
  roles?: UserRole[];
}

export interface NavGroup {
  /** Stable id */
  id: string;
  /** Sidebar / mobile label */
  label: string;
  /** Group-level icon */
  icon: IconComponent;
  /** Sub-pages. A standalone group has exactly one item and shows no SectionTabs. */
  items: NavItem[];
  /** Standalone groups (Dashboard, Settings, Store launch) render no section tabs. */
  standalone?: boolean;
  /**
   * Roles allowed to see this group. Omitted means everyone.
   *
   * Hiding here is cosmetic only — every page in a restricted group must carry
   * its own `requirePageRole`, because a hidden link is still a reachable URL.
   */
  roles?: UserRole[];
}

/**
 * Single source of truth for admin navigation. Consumed by AdminSidebar,
 * MobileNavigation and SectionTabs. Grouped by business domain: each group
 * (except standalone ones) opens onto a page whose siblings appear as tabs.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Дашборд",
    icon: IconGrid,
    standalone: true,
    items: [{ href: "/admin", label: "Дашборд", icon: IconGrid }],
  },
  {
    id: "work",
    label: "Робота",
    icon: IconRepair,
    items: [
      { href: "/admin/repairs", label: "Ремонти", icon: IconRepair },
      { href: "/admin/parts", label: "Запчастини", icon: IconParts },
      { href: "/admin/services", label: "Послуги", icon: IconService },
    ],
  },
  {
    id: "inventory",
    label: "Склад",
    icon: IconDevice,
    items: [
      { href: "/admin/devices", label: "Техніка", icon: IconDevice },
      { href: "/admin/accessories", label: "Аксесуари", icon: IconAccessory },
      { href: "/admin/suppliers", label: "Постачальники", icon: IconSupplier },
      { href: "/admin/purchases", label: "Закупівлі", icon: IconPurchase, roles: MONEY_ROLES },
    ],
  },
  {
    id: "sales",
    label: "Продажі",
    icon: IconSale,
    items: [
      { href: "/admin/sales", label: "Продажі", icon: IconSale },
      { href: "/admin/orders", label: "Замовлення", icon: IconPurchase },
      { href: "/admin/customers", label: "Клієнти", icon: IconCustomer },
      { href: "/admin/partners", label: "Партнери", icon: IconPartner },
    ],
  },
  {
    id: "finance",
    label: "Фінанси",
    icon: IconFinance,
    roles: MONEY_ROLES,
    items: [
      { href: "/admin/finance", label: "Фінанси", icon: IconFinance },
      { href: "/admin/reports", label: "Звіти", icon: IconReport },
    ],
  },
  {
    // Not prominent on purpose: the shop hasn't opened yet (24.07.2026), so
    // there's nothing here worth surfacing for at least a month. Standalone
    // + owner-only keeps it out of the main tab flow.
    id: "analytics",
    label: "Аналітика",
    icon: IconReport,
    standalone: true,
    roles: ["owner"],
    items: [{ href: "/admin/analytics", label: "Аналітика", icon: IconReport }],
  },
  {
    // Кожна з трьох дій сторінки (розподіл, чеки, ролі персоналу) і так
    // вимагає власника — для решти це був екран, де нічого не натиснеш.
    id: "settings",
    label: "Налаштування",
    icon: IconSettings,
    standalone: true,
    roles: ["owner"],
    items: [{ href: "/admin/settings", label: "Налаштування", icon: IconSettings }],
  },
  {
    id: "store-launch",
    label: "Запуск Магазину",
    icon: IconRocket,
    standalone: true,
    roles: ["owner"],
    items: [{ href: "/admin/store-launch", label: "Запуск Магазину", icon: IconRocket }],
  },
];

/** True when the given pathname belongs to the given nav item. */
export function isItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Чи дозволений елемент навігації для ролі. Без списку — дозволений усім. */
function allowed(roles: UserRole[] | undefined, rawRole: string | null | undefined): boolean {
  return !roles || roles.includes(rawRole as UserRole);
}

/** Пункти групи, доступні ролі. */
export function visibleItems(group: NavGroup, rawRole: string | null | undefined): NavItem[] {
  return group.items.filter((i) => allowed(i.roles, rawRole));
}

/**
 * Groups visible to a raw role string, з уже відфільтрованими пунктами.
 *
 * Невідома або ще не завантажена роль бачить лише необмежене: навігація падає
 * закрито, тож обмежене посилання не блимає до приходу ролі.
 *
 * Групи, з яких після фільтра не лишилось жодного пункту, зникають цілком —
 * інакше в сайдбарі був би заголовок, що розкривається в порожнечу, а клік по
 * ньому вів би на `items[0]`, якого користувачу видно не має бути.
 */
export function visibleGroups(rawRole: string | null | undefined): NavGroup[] {
  return NAV_GROUPS.filter((g) => allowed(g.roles, rawRole))
    .map((g) => ({ ...g, items: visibleItems(g, rawRole) }))
    .filter((g) => g.items.length > 0);
}

/** The group that owns the current pathname, or null. */
export function getActiveGroup(pathname: string): NavGroup | null {
  // Prefer the most specific (longest matching href) so /admin doesn't shadow others.
  let best: { group: NavGroup; len: number } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isItemActive(pathname, item.href) && (!best || item.href.length > best.len)) {
        best = { group, len: item.href.length };
      }
    }
  }
  return best?.group ?? null;
}
