# Phase 8: Public Zone Improvements

**Goal:** Add shop filters, create repair tracking page with photos + status history.

---

### Task 1: Shop Filters

**File:** `src/app/shop/page.tsx`

Add client-side filter bar for devices:
- Brand dropdown (from available brands)
- Type filter (phone/tablet/laptop)
- Price range min/max
- Search box

Use URL search params or client state. Keep it SSR-friendly — use a client wrapper.

### Task 2: Track [token] Page

**File:** `src/app/track/[token]/page.tsx`

Create tracking page that shows:
- Repair status with colored badge
- Device photos (condition photos at intake)
- Status history timeline (from repair_status_log)
- NP TTN tracking status
- Customer communication log

### Task 3: Build

`npx next build`
