"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Drawer from "@/components/ui/Drawer";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { AttentionCode, AttentionGroup } from "@/lib/attention";

const GROUP_TONES: Record<AttentionCode, BadgeTone> = {
  repair_stalled: "danger",
  repair_awaiting_parts: "warning",
  repair_unpaid: "warning",
  stock_low: "info",
};

function isRepairGroup(code: AttentionCode) {
  return code !== "stock_low";
}

/**
 * `AttentionRow` carries no `kind` field — it's `id`/`title`/`note`/`urgency`
 * only (Task 5's fixed interface). The one place a stock row's kind survives
 * is the note text: `findAttention` appends "· запчастина" for parts and
 * nothing for accessories. Fragile-looking, but it's the only signal there is
 * without reaching back into attention.ts to add a field this is the only
 * consumer of.
 */
function stockHref(note: string) {
  return note.includes("запчастина") ? "/admin/parts" : "/admin/accessories";
}

/**
 * Renders what `findAttention` found. Empty input renders nothing — a quiet
 * shop gets no "all good" card, just the absence of this section.
 *
 * A repair row opens the same detail/edit drawer the Ремонти page uses,
 * fetched fresh by id (the attention list only carries enough to render the
 * row, not the full record). No one-click status action here on purpose:
 * closing a repair moves money and fires a Telegram notification, and a
 * button that does that without the full card in view is exactly the
 * mechanism that put sold devices back into circulation in an earlier slice.
 */
export function AttentionSection({ groups }: { groups: AttentionGroup[] }) {
  const router = useRouter();
  const [selectedRepair, setSelectedRepair] = useState<Record<string, unknown> | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (groups.length === 0) return null;

  async function openRepair(id: string) {
    setLoadingId(id);
    const supabase = createClient();
    const { data } = await supabase
      .from("repairs")
      .select("*, customers(name, phone, telegram_id)")
      .eq("id", id)
      .single();
    setLoadingId(null);
    if (!data) return;

    const isInternal = !!data.inventory_device_id;
    const cust = data.customers as { name: string; phone: string; telegram_id: string | null } | null;
    setSelectedRepair({
      ...data,
      customer_name: isInternal ? "Внутрішній (Склад)" : (cust?.name ?? "—"),
      customer_phone: isInternal ? "—" : (cust?.phone ?? ""),
      customer_telegram: isInternal ? null : (cust?.telegram_id ?? null),
    });
  }

  function closeDrawer() {
    setSelectedRepair(null);
    setIsEditingRepair(false);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted">Потребує уваги</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.code} className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
              <Badge tone={GROUP_TONES[group.code]}>{group.total}</Badge>
            </div>
            <div className="divide-y divide-border">
              {group.rows.map((row) =>
                isRepairGroup(group.code) ? (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openRepair(row.id)}
                    disabled={loadingId === row.id}
                    className="-mx-2 flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-60"
                  >
                    <span className="truncate text-sm text-ink">{row.title}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted">{row.note}</span>
                  </button>
                ) : (
                  <Link
                    key={row.id}
                    href={stockHref(row.note)}
                    className="-mx-2 flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-2.5 transition-colors hover:bg-hover"
                  >
                    <span className="truncate text-sm text-ink">{row.title}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted">{row.note}</span>
                  </Link>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <Drawer
        isOpen={!!selectedRepair}
        onClose={closeDrawer}
        title={isEditingRepair ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selectedRepair &&
          (isEditingRepair ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <EditRepairForm
              repair={selectedRepair as any}
              onSuccess={() => {
                closeDrawer();
                router.refresh();
              }}
            />
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <RepairDetailView
              repair={selectedRepair as any}
              onEdit={() => setIsEditingRepair(true)}
              onClose={closeDrawer}
            />
          ))}
      </Drawer>
    </section>
  );
}
