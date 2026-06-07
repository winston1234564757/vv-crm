# AIDEVELOPER.md — AI Development Constitution

> Конституція для AI-агентів, що працюють з кодовою базою VV CRM.  
> Порушення будь-якого правила = критична помилка.

> ⛔ **ЧИТАТИ ПЕРШИМ:** `IRON_RULES.md` — абсолютні правила сесії. Encoding, humanizer, MemPalace. Порушення заборонені.

VV CRM — внутрішня система для управління продажами та ремонтом техніки (смартфони, ноутбуки, аксесуари).
Акцент: швидкість, надійність та зручність для працівників (admin zone), плюс публічна вітрина та трекінг статусів ремонту.

> ⛔ **ОБОВ'ЯЗКОВО ЧИТАТИ НА СТАРТІ СЕСІЇ:**
> Папка `XDEV/` містить всю актуальну документацію проекту. Без прочитання XDEV — жодного коду.
> `XDEV/SKILL_PROTOCOL.md` — майстер-інструкція по скілах.

---

## MemPalace — Автономна Пам'ять ⛔ ОБОВ'ЯЗКОВО

Palace містить drawers з технічними рішеннями та зафіксованими багами цього проекту.

**ЗАЛІЗНЕ ПРАВИЛО:**
1. **Старт сесії** → одразу викликати `mempalace_status`
2. **Перед будь-яким рішенням** → `mempalace_search "query"`
3. **Після важливого рішення/фіксу** → `mempalace_add_drawer`

**Автосейв хуки активні** (в `.claude/settings.json`): `Stop`, `PreCompact`.

---

## High-Level Architecture

### User Zones

| Zone | Routes | Auth |
|---|---|---|
| **Admin Zone** | `/admin/**` | Required — admin/staff role |
| **Public Zone** | `/`, `/repair/[code]` | Anonymous OK |

### Routing Guard
`src/proxy.ts` exports `async function proxy(request: NextRequest)` — заміняє `middleware.ts`. Ніколи не додавати захист роутів напряму в middleware.

### Supabase Client Hierarchy
- `client.ts` — browser client
- `server.ts` — SSR client (Server Components & Actions)
- `admin.ts` — ONLY source of `service_role_key` (API routes + cron)

### Data Flow Pattern
- Server Components → `src/lib/supabase/server.ts`
- Client Components → TanStack Query
- Admin operations → `createAdminClient()` only

---

## Tech Stack

- **Next.js 16** App Router + Turbopack, **React 19**
- **TypeScript** strict (`noImplicitAny: true`)
- **Tailwind CSS v4**
- **TanStack Query v5**
- **Supabase**
- **Zustand**, **Zod**, **Framer Motion**

### staleTime norms (iron rule)
- Dashboard stats: 1 min
- Analytics: 5 min
- Inventory/Services: 10 min
- Bookings/Repairs list: 2 min

---

## Pre-Deploy Checklist
- [ ] `src/proxy.ts` exports `proxy` (no route logic in `middleware.ts`)
- [ ] RLS enabled on every new Supabase table
- [ ] `createAdminClient()` only in admin-only operations
