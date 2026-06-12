# Phase 7: Nova Post API + Monobank

**Goal:** Nova Post TTN tracking API client + Monobank payment reference in payment_splits.

---

### Task 1: Nova Post API Client

**File:** `src/lib/services/nova-poshta.ts`

Create a server-side client to call Nova Post API for TTN status:

```ts
const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";

export async function trackTTN(ttn: string) {
  const response = await fetch(NP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: process.env.NOVA_POSHTA_API_KEY,
      modelName: "TrackingDocument",
      calledMethod: "getStatusDocuments",
      methodProperties: { Documents: [{ DocumentNumber: ttn }] },
    }),
  });
  const json = await response.json();
  return json.data?.[0] ?? null;
}
```

Add to `.env`: `NOVA_POSHTA_API_KEY=your_key_here`

### Task 2: TTN Tracking Component

**File:** `src/components/NPTrackingStatus.tsx`

Client component that shows Nova Post delivery status for a TTN:
- Pill with status text + color
- Click to expand details

### Task 3: Monobank Payment Reference

**File:** `src/lib/actions/purchases.ts` + `src/lib/actions/sales.ts`

Add `monobank_payment_id` to payment_splits when method is "card". Not creating a separate Monobank API — just a reference field.

### Task 4: Migration SQL

**File:** `docs/migrations/006_nova_poshta_monobank.sql`

```sql
ALTER TABLE payment_splits ADD COLUMN IF NOT EXISTS monobank_payment_id text;
```

### Task 5: Update Types

**File:** `src/types/database.ts`

Add `monobank_payment_id` to payment_splits Row/Insert/Update.

### Task 6: Build

`npx next build`
