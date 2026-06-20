"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { PurchaseDetailView } from "@/components/PurchaseDetailView";
import { useRouter } from "next/navigation";

import type { getFinanceData } from "@/lib/data-finance";
import type { SaleWithDetails } from "@/lib/data-sales";
import type { getRepairs } from "@/lib/data-repairs";
import type { getPurchases } from "@/lib/data-purchases";

type TransactionRow = Awaited<ReturnType<typeof getFinanceData>>["transactions"][number];
type RepairRow = Awaited<ReturnType<typeof getRepairs>>[number];
type PurchaseRow = Awaited<ReturnType<typeof getPurchases>>[number];

interface FinanceTransactionsTableProps {
  transactions: TransactionRow[];
  sales: SaleWithDetails[];
  repairs: RepairRow[];
  purchases: PurchaseRow[];
}

const typeColors: Record<string, string> = {
  sale: "var(--color-cyan)",
  expense: "var(--color-rose)",
  distribution: "var(--color-violet)",
};

const typeLabels: Record<string, string> = {
  sale: "Надходження",
  expense: "Витрата",
  distribution: "Розподіл",
};

export function FinanceTransactionsTable({
  transactions,
  sales,
  repairs,
  purchases,
}: FinanceTransactionsTableProps) {
  const router = useRouter();

  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairRow | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);

  function handleRowClick(t: TransactionRow) {
    if (!t.reference_type || !t.reference_id) return;

    if (t.reference_type === "sale") {
      const sale = sales.find((s) => s.id === t.reference_id);
      if (sale) {
        setSelectedSale(sale);
      }
    } else if (t.reference_type === "repair_payment") {
      const repair = repairs.find((r) => r.id === t.reference_id);
      if (repair) {
        setSelectedRepair(repair);
      }
    } else if (t.reference_type === "purchase") {
      const purchase = purchases.find((p) => p.id === t.reference_id);
      if (purchase) {
        setSelectedPurchase(purchase);
      }
    }
  }

  return (
    <>
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary">Рух коштів</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-iris/10 text-left text-xs font-medium text-text-secondary">
                <th className="pb-2 pr-4">Дата</th>
                <th className="pb-2 pr-4">Від</th>
                <th className="pb-2 pr-4">До</th>
                <th className="pb-2 pr-4">Тип</th>
                <th className="pb-2 pr-4 max-w-[200px]">Опис</th>
                <th className="pb-2 text-right">Сума</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const hasRef = !!t.reference_type && !!t.reference_id;
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowClick(t)}
                    className={`border-b border-iris/5 text-text-primary transition-colors ${
                      hasRef
                        ? "cursor-pointer hover:bg-violet/[0.04] active:bg-violet/[0.08]"
                        : "hover:bg-warm-surface/20"
                    }`}
                  >
                    <td className="py-3 pr-4 text-xs text-text-secondary whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {t.date}
                        {hasRef && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet" title="Пов'язана сума" />
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">{t.from}</td>
                    <td className="py-3 pr-4 font-medium">{t.to}</td>
                    <td className="py-3 pr-4">
                      <span
                        className="rounded-lg px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={{
                          background: `color-mix(in oklch, ${
                            typeColors[t.type] ?? "var(--color-iris)"
                          } 18%, transparent)`,
                          color: typeColors[t.type] ?? "var(--color-iris)",
                        }}
                      >
                        {typeLabels[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary text-xs max-w-[200px] truncate" title={t.description}>
                      {t.description}
                    </td>
                    <td className="py-3 text-right font-medium whitespace-nowrap">
                      {t.amount.toLocaleString()} грн
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-text-secondary">
                    Немає транзакцій
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Drawer */}
      <Drawer isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Деталі продажу" size="half">
        {selectedSale && <SaleDetailView sale={selectedSale} onClose={() => setSelectedSale(null)} />}
      </Drawer>

      {/* Repair Detail/Edit Drawer */}
      <Drawer
        isOpen={!!selectedRepair}
        onClose={() => {
          setSelectedRepair(null);
          setIsEditingRepair(false);
        }}
        title={isEditingRepair ? "Редагувати ремонт" : "Деталі ремонту"}
        size="half"
      >
        {selectedRepair &&
          (isEditingRepair ? (
            <EditRepairForm
              onSuccess={() => {
                setSelectedRepair(null);
                setIsEditingRepair(false);
                router.refresh();
              }}
              repair={selectedRepair as unknown as Parameters<typeof EditRepairForm>[0]["repair"]}
            />
          ) : (
            <RepairDetailView
              repair={selectedRepair as unknown as Parameters<typeof RepairDetailView>[0]["repair"]}
              onEdit={() => setIsEditingRepair(true)}
              onClose={() => setSelectedRepair(null)}
            />
          ))}
      </Drawer>

      {/* Purchase Detail Drawer */}
      <Drawer isOpen={!!selectedPurchase} onClose={() => setSelectedPurchase(null)} title="Деталі закупівлі" size="half">
        {selectedPurchase && (
          <PurchaseDetailView
            purchase={selectedPurchase}
            onStatusUpdated={() => {
              setSelectedPurchase(null);
              router.refresh();
            }}
            onClose={() => setSelectedPurchase(null)}
          />
        )}
      </Drawer>
    </>
  );
}
