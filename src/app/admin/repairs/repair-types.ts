import type { Database } from "@/types/database";
import type { AIDiagnosticData } from "@/components/RepairDetailView";

type DbRepairRow = Database["public"]["Tables"]["repairs"]["Row"];

/**
 * A repair as the list needs it: the row plus the customer fields resolved by
 * `attachCustomerName` in `data-repairs.ts`.
 *
 * There is no `repair_type` here on purpose. It was never a column — the data
 * layer stamped the constant "customer" onto every row, which made two of the
 * page's filter chips unable to match anything.
 */
export interface RepairRow extends Omit<DbRepairRow, "ai_diagnostic"> {
  customer_name: string;
  customer_phone: string;
  customer_telegram: string | null;
  /** `jsonb` in the database; narrowed to the shape the app actually writes. */
  ai_diagnostic: AIDiagnosticData | null;
}

/** A repair with the ledger total attached, so debt is real rather than a label. */
export interface RepairWithPayments extends RepairRow {
  paid_amount: number;
}

export function isOverdue(r: Pick<RepairRow, "estimated_completion" | "status">): boolean {
  if (!r.estimated_completion) return false;
  if (["ready", "completed", "handed_over", "cancelled"].includes(r.status)) return false;
  return new Date(r.estimated_completion) < new Date();
}
