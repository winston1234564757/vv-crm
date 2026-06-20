# Task Plan: Replace `as unknown as` casts with `supabaseCast`

## Goal
Eliminate all TS2352 "conversion may be a mistake" errors by rewriting `as unknown as` casts using the `supabaseCast<Type>(data)` utility across five UI component files.

## Current Phase
Phase 3 (Editing)

## Phases

### Phase 1: Discovery & Context (complete)
- [x] Confirm `src/lib/utils/supabase.ts` exists and exports `supabaseCast`
- [x] Read all five affected files to identify exact cast lines
- [x] Document all cast locations and their target types
- **Status:** complete

### Phase 2: Preparation (complete)
- [x] Determine import statement: `import { supabaseCast } from "@/lib/utils/supabase"`
- [x] Determine approach: replace `value as unknown as Type` with `supabaseCast<Type>(value)`
- [x] Determine fallback pattern: `value ? supabaseCast<Type>(value) : []` for nullable data
- **Status:** complete

### Phase 3: Editing (in_progress)
- [ ] Edit `src/app/admin/devices/page.tsx` — 1 cast (line 71)
- [ ] Edit `src/components/ui/ReceiptPrintModal.tsx` — 1 cast (line ~115)
- [ ] Edit `src/components/RepairDetailView.tsx` — 1 cast (line 492)
- [ ] Edit `src/components/DeviceDetailView.tsx` — 2 casts (lines 437, 441)
- [ ] Edit `src/app/admin/finance/FinanceTransactionsTable.tsx` — 2 casts (lines 169, 173)
- **Status:** in_progress

### Phase 4: Verification (pending)
- [ ] Run `npx tsc --noEmit` to confirm TS2352 errors are gone
- [ ] Run project build to confirm no regressions
- **Status:** pending

### Phase 5: Cleanup (pending)
- [ ] Commit changes
- **Status:** pending

## Cast Locations (precise)
| File | Line | Current Code |
|------|------|-------------|
| `src/app/admin/devices/page.tsx` | 71 | `devices as unknown as import('./table').DeviceRow[]` |
| `src/components/ui/ReceiptPrintModal.tsx` | ~115 | `settings as unknown as ReceiptSettings` |
| `src/components/RepairDetailView.tsx` | 492 | `p.parts as unknown as { name: string; compatible_with: string \| null } \| null` |
| `src/components/DeviceDetailView.tsx` | 437 | first cast (value unknown) |
| `src/components/DeviceDetailView.tsx` | 441 | second cast (value unknown) |
| `src/app/admin/finance/FinanceTransactionsTable.tsx` | 169 | first cast |
| `src/app/admin/finance/FinanceTransactionsTable.tsx` | 173 | second cast |

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `supabaseCast<T>(value)` | Already defined in `supabase.ts`, eliminates TS2352 safely |
| Use `import(…)` type syntax | For types not directly importable (e.g., DeviceRow from ./table) |
| Fallback `value ? supabaseCast<T>(value) : []` | For nullable data arrays |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
