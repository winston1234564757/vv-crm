# VV CRM Mobile-First UX/UI Redesign

**Date:** 2026-06-08
**Status:** Draft
**Supersedes:** DESIGN.md (partial)

## 1. Overview

VV CRM — internal electronics sales & repair management system. This spec defines a mobile-first (A→B priority) UX/UI redesign that resolves conflicts between the existing DESIGN.md and current implementation, while adapting the interface for mobile use cases.

### Core Principle

Mobile-first progressive enhancement: full functionality on phones (priority A), tablet-optimized (priority B), desktop as the richest experience.

## 2. Design Language

Hybrid between the "Warm Workshop Bench" (DESIGN.md) and glassmorphism:

| Layer | Mobile | Desktop |
|-------|--------|---------|
| Card surfaces | Solid white, warm shadow `0 1px 3px oklch(0% 0 0 / 0.06)` | Solid white with optional glass insert elements |
| Backgrounds | Solid warm tones (`oklch(96% 0.006 60)`) | Same, no gradient |
| Accent | Warm Violet (`oklch(50% 0.18 290)`) | Same |
| Glass effect | None (performance + readability) | Limited — `backdrop-blur` on decorative backgrounds only (section headers, hero-like banners), never on interactive cards, forms, or navigation |
| Shadows | Warm, shallow | Warm, scaled by elevation |

### Rationale

- Mobile needs solid surfaces for readability in sunlight, touch targets, and performance
- Desktop can afford subtle glass elements for visual depth
- Keeps the "warm workshop" identity across both

## 3. Typography

Readex Pro — single family, unchanged from DESIGN.md scale:

| Style | Weight | Size | Line Height |
|-------|--------|------|-------------|
| Display | Bold 700 | 1.75rem | 1.15 |
| Headline | SemiBold 600 | 1.25rem | 1.2 |
| Title | Medium 500 | 1rem | 1.3 |
| Body | Regular 400 | 0.9375rem | 1.5 |
| Label | Medium 500 | 0.75rem | 1.3 |
| Mobile body | Regular 400 | 1rem (16px) | 1.5 |

Mobile body minimum: 16px to prevent iOS zoom on input focus.

## 4. Navigation

### Mobile (bottom tab bar)

5 fixed tabs, always visible:

```
[📊] [👤] [➕] [🔧] [💰]
Дашб. Клієнти      Ремонт Продажі
```

All icons are SVG (not emoji) — consistent with existing `icons.tsx` pattern.

- **➕ (центр)**: Opens a bottom sheet grid with remaining sections: Фінанси, Звіти, Аксесуари, Запчастини, Постачальники, Закупівлі, Послуги
- Active tab: Warm Violet tint
- Tab bar: solid white with top border

### Tablet

Sidebar (collapsible) — same as desktop but can collapse to icon-only.
Bottom tab bar hidden on tablet (width > 768px).

### Desktop

Full sidebar (current pattern but redesigned):
- Warm neutral surface (`oklch(94% 0.005 60)`)
- Active item: Warm Violet tinted background (`oklch(50% 0.06 290 / 0.1)`)
- Icons + labels
- User section at bottom with avatar, role, email, logout

## 5. Dashboard

### Mobile layout (single column):

1. **Header row**: live time (HH:MM) + date + user name
2. **Stats row** (horizontal scroll if needed): загальна виручка | чистий прибуток | нові ремонти | продажі сьогодні
3. **Quick actions**: two large buttons "Продати" | "Відремонтувати" (full width, touch-friendly min 48px height)
4. **Widget carousel**: horizontal scroll of section previews each with `→` button to navigate to full page
   - **Клієнти**: останні 3 клієнти (ім'я, дата візиту)
   - **Ремонти**: активні ремонти (пристрій, статус)
   - **Запаси**: низький запас аксесуарів (назва, кількість)
   - **Закупівлі**: останні закупівлі (постачальник, сума)

### Desktop layout (multi-column):

- Same sections but arranged in grid
- Stats: 4 columns
- Quick actions: side by side
- Widgets: 2-3 column grid

## 6. List Views (Tables)

### Mobile

Card-based layout (marketplace style):
- **Devices/Accessories**: photo thumbnail, brand/model, price, stock/status badge
- **Customers**: name, phone, discount badge, last visit
- **Repairs**: device name, customer, status badge, price
- **Parts/Suppliers**: name, type/category, stock/count

Each card:
- Tap to open detail
- Swipe left → reveal actions: edit (primary), delete (danger, red)
- Search bar at top
- Sort/filter chips below search

### Desktop

Full table with columns, header row, hover states:
- Same data as mobile cards but in tabular format
- Checkbox for batch actions
- Sortable columns
- Pagination or infinite scroll

### Common

- Search bar (URL-param driven, existing `useFilter`)
- Filter chips/tabs for status filtering
- Empty state illustration + message

## 7. Forms

All complex forms broken into step wizards:

### SaleForm (3 steps)
1. **Товар**: select type (accessory/device/service) + pick item(s) + quantity
2. **Клієнт**: search/create customer + discount
3. **Оплата**: method (cash/card/transfer) + split payment + delivery info
- Mobile: 1 step per screen, bottom "Далі"/"Назад"
- Desktop: all steps visible in a stepper

### RepairForm (3 steps)
1. **Пристрій + проблема**: device name, IMEI, issue nodes, diagnostics chips, condition
2. **Клієнт**: search/create customer
3. **Ціна + терміни**: price, cost, warranty, estimated completion, notes

### DeviceForm (2-3 steps)
1. **Тип + модель**: type, brand, model, IMEI, color, storage
2. **Стан + ціна**: condition grade, description, cost, price, source
3. **Склад** (optional): warehouse location, serial number, original box

### Form components (shared)
- `FormStep` — wrapper for a step with title
- `FormStepper` — step indicator (dots on mobile, numbered on desktop)
- All existing form fields preserved but reorganized
- Each step validates before advancing
- Server action (useActionState) on final submit

## 8. Components (new shared library)

Create reusable components under `src/components/ui/`:

- `Button` — primary/secondary/ghost/danger + size variants, active scale(0.97)
- `Input` — existing, enhance with prefix/suffix icons
- `Select` — styled native select
- `Card` — solid white, warm shadow, 12px radius
- `BottomTabBar` — mobile navigation (client component)
- `BottomSheet` — portal-based drawer from bottom (mobile + tablet)
- `SwipeableRow` — swipe-to-reveal actions (mobile lists)
- `Skeleton` — loading states
- `EmptyState` — icon + message + optional CTA
- `StatCard` — metric display (number + label + trend)
- `WidgetCard` — preview card with title + content + `→` link

## 9. Colors (consolidated tokens)

```
--color-bg: oklch(96% 0.006 60)         /* warm page */
--color-card: oklch(100% 0 0 / 1)        /* solid white */
--color-sidebar: oklch(94% 0.005 60)     /* warm sidebar */
--color-primary: oklch(50% 0.18 290)     /* Warm Violet */
--color-primary-hover: oklch(42% 0.18 290)
--color-primary-subtle: oklch(50% 0.06 290 / 0.1)
--color-text: oklch(20% 0.01 60)
--color-text-secondary: oklch(40% 0.01 60)
--color-text-muted: oklch(55% 0.01 60)
--color-error: oklch(50% 0.2 25)
--color-warning: oklch(65% 0.18 85)
--color-success: oklch(55% 0.15 145)
--color-info: oklch(55% 0.12 210)
--shadow-card: 0 1px 3px oklch(0% 0 0 / 0.06)
--shadow-card-hover: 0 4px 12px oklch(0% 0 0 / 0.1)
--radius-card: 12px
--radius-button: 10px
--radius-input: 10px
```

## 10. Motion & Interaction

- **Duration**: 150-250ms UI, 100ms press feedback
- **Easing**: `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out)
- **Mobile**: swipe gestures, bottom sheet slide-up, tab transitions
- **Desktop**: hover states, stagger entry animations
- **`prefers-reduced-motion`**: keep opacity/color, remove movement
- **No decorative motion**: every animation conveys state change

## 11. Mobile-specific Considerations

- Min touch target: 44px (Apple HIG) / 48px (Material Design)
- Bottom sheet for filters/actions rather than modals
- Pull-to-refresh on list views
- Safe area insets (notch, home indicator)
- Keyboard avoidance on form inputs
- No horizontal overflow — everything scrolls vertically
- Body scroll lock when drawer/bottom sheet open

## 12. Implementation Order

**This is a large project.** The implementation order defines 10 phases, each of which should be a separate implementation plan (spec → plan → execute). Each phase produces a working, testable increment.

1. **Design tokens** in globals.css (colors, shadows, radii as CSS variables)
2. **Shared components** (Button, Card, StatCard, WidgetCard, EmptyState, Skeleton, SwipeableRow)
3. **Навігація** (bottom tab bar + new sidebar) — інтегруємо в layout рано, бо впливає на всі сторінки
4. **Клієнти** (список картками + форма wizard)
5. **Ремонти** (список + форма wizard)
6. **Продажі** (список + форма wizard + оплата)
7. **Пристрої** (card view + форма wizard)
8. **Дашборд** (new layout + widgets)
9. **Інші розділи** (аксесуари, запчастини, постачальники, закупівлі, послуги)
10. **Фінанси + Звіти**

## 13. Existing Patterns to Preserve

- URL-param based search/filter (`useFilter`)
- Drawer slide-in for create/edit (desktop)
- Admin client data access pattern
- React 19 `useActionState` for forms
- Zod validation

## 14. Open Questions

- Monobank integration — any changes needed?
- Export/print — should any sections support this?
- Notification system — real-time updates needed?
