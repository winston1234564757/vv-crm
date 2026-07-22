"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database";

import { ListPageShell } from "@/components/list/ListPageShell";
import { useListQuery } from "@/components/list/useListQuery";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Toolbar, SearchField } from "@/components/ui/Toolbar";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import { InlineError } from "@/components/ui/InlineError";
import { IconRepair, IconCash } from "@/components/icons";

import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { AddRepairButton } from "./AddRepairButton";

import { updateRepairStatus, payRepair } from "@/lib/actions/repairs";
import { optionsOf, repairStatus, repairSource } from "@/lib/domain-labels";
import {
  repairGroup,
  repairGroupLabels,
  REPAIR_GROUP_ORDER,
  nextStep,
  isUnpaid,
  outstanding,
  type RepairGroup,
} from "@/lib/repair-flow";

import { repairColumns, repairCard } from "./repair-columns";
import type { RepairRow, RepairWithPayments } from "./repair-types";

type Segment = "all" | RepairGroup | "debt";

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface Device {
  id: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  status: string;
}

interface RepairsClientProps {
  repairs: RepairRow[];
  paidTotals: Record<string, number>;
  customers: Customer[];
  inStockDevices: Device[];
  cashRegisters: Database["public"]["Tables"]["cash_registers"]["Row"][];
}

export function RepairsClient({
  repairs,
  paidTotals,
  customers,
  inStockDevices,
  cashRegisters,
}: RepairsClientProps) {
  const router = useRouter();
  const query = useListQuery({
    mode: "client",
    filters: { seg: "all", status: "all", source: "all" },
  });

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<RepairWithPayments | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [paying, setPaying] = useState<RepairWithPayments | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payRegister, setPayRegister] = useState("");
  const [handover, setHandover] = useState<RepairWithPayments | null>(null);

  const rows: RepairWithPayments[] = useMemo(
    () => repairs.map((r) => ({ ...r, paid_amount: paidTotals[r.id] ?? 0 })),
    [repairs, paidTotals],
  );

  const segment = (query.filters.seg ?? "all") as Segment;

  /** Everything except the segment — the segment counts are derived from this. */
  const base = useMemo(() => {
    const q = query.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = [r.customer_name, r.customer_phone, r.device_name, r.issue, r.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (query.filters.status !== "all" && r.status !== query.filters.status) return false;
      if (query.filters.source !== "all" && r.source !== query.filters.source) return false;
      return true;
    });
  }, [rows, query.search, query.filters]);

  const counts = useMemo(() => {
    const c: Record<Segment, number> = {
      all: base.length,
      active: 0,
      ready: 0,
      done: 0,
      cancelled: 0,
      debt: 0,
    };
    for (const r of base) {
      c[repairGroup(r.status)] += 1;
      if (isUnpaid(r)) c.debt += 1;
    }
    return c;
  }, [base]);

  const visible = useMemo(() => {
    if (segment === "all") return base;
    if (segment === "debt") return base.filter(isUnpaid);
    return base.filter((r) => repairGroup(r.status) === segment);
  }, [base, segment]);

  const tabs: TabItem<Segment>[] = [
    { value: "all", label: "Усі", count: counts.all },
    ...REPAIR_GROUP_ORDER.map((g) => ({
      value: g as Segment,
      label: repairGroupLabels[g],
      count: counts[g],
    })),
    // Only a tab when there is money to chase.
    ...(counts.debt > 0
      ? [{ value: "debt" as Segment, label: "Борг", count: counts.debt }]
      : []),
  ];

  function run(fn: () => Promise<{ success: boolean; error?: string | null }>, onOk?: () => void) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        onOk?.();
        router.refresh();
      } else {
        setError(res.error || "Не вдалося виконати дію");
      }
    });
  }

  function advance(r: RepairWithPayments) {
    const step = nextStep(r.status);
    if (!step) return;
    // Handing a device back while the customer still owes for it is allowed —
    // warranty work is free and people do pay later — but it should be a
    // decision, not an accident. It has already happened once unnoticed.
    if (step.target === "handed_over" && isUnpaid(r)) {
      setHandover(r);
      return;
    }
    run(() => updateRepairStatus(r.id, step.target));
  }

  function openPayment(r: RepairWithPayments) {
    setPaying(r);
    setPayAmount(String(outstanding(r, r.paid_amount)));
    setPayRegister(
      cashRegisters.find((c) => c.type === "repairs")?.id ?? cashRegisters[0]?.id ?? "",
    );
  }

  const actionColumn = {
    key: "actions",
    header: "",
    align: "right" as const,
    interactive: true,
    cell: (r: RepairWithPayments) => {
      const step = nextStep(r.status);
      return (
        <div className="flex items-center justify-end gap-1.5">
          {isUnpaid(r) && (
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<IconCash size={13} />}
              onClick={() => openPayment(r)}
            >
              Оплата
            </Button>
          )}
          {step && (
            <Button size="sm" disabled={isPending} onClick={() => advance(r)}>
              {step.label}
            </Button>
          )}
        </div>
      );
    },
  };

  const owed = paying ? outstanding(paying, paying.paid_amount) : 0;
  const amountNum = Number(payAmount);
  const amountInvalid = !Number.isFinite(amountNum) || amountNum <= 0 || amountNum > owed;

  return (
    <>
      <InlineError message={error} onClose={() => setError("")} />

      <Tabs
        tabs={tabs}
        value={segment}
        onValueChange={(v) => query.setFilter("seg", v)}
        aria-label="Стан ремонтів"
        className="mb-4"
      />

      <ListPageShell
        query={query}
        rows={visible}
        getRowId={(r) => r.id}
        columns={[...repairColumns(), actionColumn]}
        card={repairCard}
        onRowClick={(r) => {
          setSelected(r);
          setIsEditing(false);
        }}
        itemLabel="ремонтів"
        toolbar={
          <Toolbar
            search={
              <SearchField
                value={query.draftSearch}
                onChange={(e) => query.setDraftSearch(e.target.value)}
                onClear={query.clearSearch}
                placeholder="Клієнт, телефон, пристрій, несправність..."
              />
            }
          >
            <Select
              value={query.filters.status}
              onChange={(e) => query.setFilter("status", e.target.value)}
              className="h-9 w-auto py-0 text-xs"
              aria-label="Статус"
            >
              <option value="all">Усі статуси</option>
              {optionsOf(repairStatus).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              value={query.filters.source}
              onChange={(e) => query.setFilter("source", e.target.value)}
              className="h-9 w-auto py-0 text-xs"
              aria-label="Джерело"
            >
              <option value="all">Усі джерела</option>
              {optionsOf(repairSource).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Toolbar>
        }
        empty={{
          title:
            segment === "debt"
              ? "Боргів немає"
              : segment === "all"
                ? "Ремонтів ще немає"
                : `У групі «${repairGroupLabels[segment as RepairGroup] ?? ""}» порожньо`,
          description:
            segment === "debt"
              ? "Усі виконані ремонти оплачені."
              : "Прийміть перший апарат — він одразу стане в чергу.",
          icon: <IconRepair size={20} />,
          action:
            segment === "all" ? (
              <AddRepairButton customers={customers} devices={inStockDevices} />
            ) : undefined,
        }}
        noResults={{
          title: "Нічого не знайдено",
          description: "Подивіться на лічильники груп — можливо, ремонт в іншій.",
        }}
      />

      {/* Деталі та редагування */}
      <Drawer
        isOpen={!!selected}
        onClose={() => {
          setSelected(null);
          setIsEditing(false);
        }}
        title={isEditing ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selected &&
          (isEditing ? (
            <EditRepairForm
              repair={selected}
              onSuccess={() => {
                setSelected(null);
                setIsEditing(false);
                router.refresh();
              }}
            />
          ) : (
            <RepairDetailView
              repair={selected}
              onEdit={() => setIsEditing(true)}
              onClose={() => setSelected(null)}
              onPay={isUnpaid(selected) ? () => {
                openPayment(selected);
                setSelected(null);
              } : undefined}
            />
          ))}
      </Drawer>

      {/* Прийом оплати — рухає гроші в касу */}
      <Modal
        isOpen={!!paying}
        onClose={() => setPaying(null)}
        title="Прийняти оплату"
        description={
          paying ? `${paying.device_name} · до сплати ${owed.toLocaleString()} ₴` : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaying(null)}>
              Скасувати
            </Button>
            <Button
              isLoading={isPending}
              disabled={amountInvalid || !payRegister}
              onClick={() =>
                paying &&
                run(() => payRepair(paying.id, payRegister, amountNum), () => setPaying(null))
              }
            >
              Прийняти {Number.isFinite(amountNum) ? `${amountNum.toLocaleString()} ₴` : ""}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Сума"
            type="number"
            inputMode="numeric"
            min={1}
            max={owed}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            error={
              amountInvalid && payAmount !== ""
                ? `Введіть суму від 1 до ${owed.toLocaleString()} ₴`
                : undefined
            }
            hint={`Залишок за ремонтом — ${owed.toLocaleString()} ₴. Часткову оплату можна прийняти кілька разів.`}
          />
          <Select
            label="Каса"
            value={payRegister}
            onChange={(e) => setPayRegister(e.target.value)}
          >
            {cashRegisters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Видача неоплаченого — рішення, а не випадковість */}
      <Modal
        isOpen={!!handover}
        onClose={() => setHandover(null)}
        title="Видати без оплати?"
        description={
          handover
            ? `За ремонтом «${handover.device_name}» не сплачено ${outstanding(handover, handover.paid_amount).toLocaleString()} ₴.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHandover(null)}>
              Скасувати
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const r = handover;
                setHandover(null);
                if (r) openPayment(r);
              }}
            >
              Спершу оплата
            </Button>
            <Button
              variant="danger"
              isLoading={isPending}
              onClick={() =>
                handover &&
                run(() => updateRepairStatus(handover.id, "handed_over"), () => setHandover(null))
              }
            >
              Видати
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Ремонт залишиться в групі «Борг», доки оплату не буде внесено.
        </p>
      </Modal>
    </>
  );
}
