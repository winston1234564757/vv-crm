# VV CRM — Data Model Expansion & New Modules

## Scope

Expand all existing entities with missing fields, add 3 new modules (Suppliers, Parts, Purchases), integrate Nova Post API and Monobank, and enhance the public zone.

---

## 1. Entity Expansions

### 1.1 Devices

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `trade_in`, `buyout`, `supplier`, `olx`, `marketplace`, `customer_return`, `other` |
| `source_reference` | text | e.g. OLX ad number, buyout receipt ref |
| `purchased_from` | text | Free text — who it was bought from |
| `condition_grade` | enum | `new`, `like_new`, `good`, `fair`, `poor` |
| `condition_description` | text | |
| `original_box` | boolean | Includes original box |
| `accessories_included` | text | Charger, cable, case… |
| `serial_number` | text | For laptops, separate from IMEI |
| `warehouse_location` | text | Shelf/bin location |

### 1.2 Accessories

| Field | Type | Notes |
|---|---|---|
| `source` | enum | Same as devices |
| `barcode` | text | |
| `warehouse_location` | text | |

### 1.3 Customers

| Field | Type | Notes |
|---|---|---|
| `vip_status` | boolean | |
| `tags` | text[] | e.g. `{vip, wholesale, warranty}` |
| `source` | text | `walk_in`, `referral`, `olx`, `instagram`, `website` |
| `preferred_contact` | text | `phone`, `telegram`, `email`, `viber` |
| `notes_about_preferences` | text | Brand/color/size preferences |
| `last_purchase_date` | computed | From sales data |

### 1.4 Repairs

| Field | Type | Notes |
|---|---|---|
| `source` | enum | `walk_in`, `phone`, `online`, `marketplace` |
| `device_password` | text | |
| `device_accessories_included` | text | What customer handed over |
| `device_condition` | enum | `new`, `like_new`, `good`, `fair`, `poor` |
| `device_condition_description` | text | |
| `device_condition_photos` | text[] | Required on creation |
| `estimated_completion` | timestamptz | |
| `payment_status` | enum | `unpaid`, `paid`, `partial` |
| `diagnosis_result` | text | |
| `technician_notes_internal` | text | Not customer-visible |
| `customer_communication_log` | jsonb | `[{timestamp, type, note, staff_id}]` |

### 1.5 Sales

| Field | Type | Notes |
|---|---|---|
| `sale_type` | enum | `retail`, `wholesale`, `online` |
| `delivery_needed` | boolean | |
| `delivery_address` | text | |
| `delivery_tracking` | text | NP TTN |
| `warranty_start` | date | Auto-set on sale |
| `return_reason` | text | If returned |
| `monobank_payment_id` | text | For reconciliation |

### 1.6 Services

| Field | Type | Notes |
|---|---|---|
| `duration_minutes` | int | |
| `warranty_days` | int | Default 0 |

### 1.7 Purchases

| Field | Type | Notes |
|---|---|---|
| `order_number` | text | |
| `expected_delivery` | date | |
| `payment_terms` | text | Prepaid/postpaid/installments |
| `export_for_supplier` | feature | PDF/XLSX download |

### 1.8 repair_status_log

| Field | Type | Notes |
|---|---|---|
| `is_customer_visible` | boolean | Default true |

---

## 2. New Modules (Full CRUD UI)

### 2.1 Suppliers (`/admin/suppliers`)

- Already in DB: `suppliers` table
- Add full page: table + drawer form
- Link to devices, accessories, parts
- Show purchase history

### 2.2 Parts Warehouse (`/admin/parts`)

- Full UI for `parts` table (already in DB)
- Stock in/out movements
- Low-stock alerts
- Auto-deduct via `repair_parts` on repair
- Link to repair history

### 2.3 Purchases (`/admin/purchases`)

- Full purchase order workflow
- Create PO → select supplier → add items (devices/accessories/parts)
- Statuses: `pending`, `paid`, `partial`, `delivered`
- "Receive" button → items to stock, money from safe
- Export PO as PDF/XLSX for supplier

---

## 3. Integrations

### 3.1 Nova Post API

- Unified tracking widget for all TTNs
- Sources: device repair, parts order, purchase delivery, sale delivery
- Show status + tracking link in UI

### 3.2 Monobank

- Store `monobank_payment_id` on card payments
- Auto-reconciliation: match sales ↔ Monobank transactions
- No separate cash register — money goes to existing registers

---

## 4. Finance

- P&L report: revenue - cost - expenses by period
- Cash register reconciliation (expected vs actual)
- All existing transaction logic unchanged

---

## 5. Public Zone

### 5.1 Shop (`/shop`)

- Filters: type, brand, price range
- Show stock status
- Product photos
- No checkout — showcase only

### 5.2 Repair Tracking (`/track/[token]`)

- Status timeline from `repair_status_log`
- Device photos upon receipt
- NP tracking link
- Estimated completion date

---

## 6. Implementation Order

| Phase | Modules |
|---|---|
| 1 | Parts warehouse + Suppliers |
| 2 | Devices + Accessories expansions |
| 3 | Repairs expansion + condition photos |
| 4 | Sales + Services expansions |
| 5 | Customers expansion |
| 6 | Purchases module |
| 7 | Nova Post API + Monobank |
| 8 | Public zone |
| 9 | Finance reports |
