"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { PurchaseDetailView } from "@/components/PurchaseDetailView";
import { useRouter } from "next/navigation";
import { IconSpinner, IconDelete } from "@/components/icons";
import { deleteTransactionAction } from "@/lib/actions/finance";

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
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteTransaction(id: string) {
    const confirmed = window.confirm(
      "Ви впевнені, що хочете видалити цю транзакцію/переказ? Грошовий рух буде скасовано, а баланси кас та сейфів скориговані."
    );
    if (!confirmed) return;

    setDeletingId(id);

    try {
      const res = await deleteTransactionAction(id);
      if (res.success) {
        setSelectedTransaction(null); // Close drawer if deleting from inside it
        router.refresh();
      } else {
        alert(res.error || "Не вдалося видалити транзакцію.");
      }
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      alert("Сталася неочікувана помилка при видаленні.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleRowClick(t: TransactionRow) {
    if (!t.reference_type || !t.reference_id) {
      setSelectedTransaction(t);
      return;
    }

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
                <th className="pb-2 text-right w-16">Дії</th>
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
                    <td className="py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {(!t.reference_type || !["sale", "repair_payment", "purchase"].includes(t.reference_type)) ? (
                        <button
                          disabled={deletingId === t.id}
                          onClick={() => handleDeleteTransaction(t.id)}
                          className="text-rose hover:text-rose/85 disabled:opacity-50 p-1 cursor-pointer transition-colors inline-flex items-center justify-center align-middle"
                          title="Видалити"
                        >
                          {deletingId === t.id ? (
                            <IconSpinner size={14} className="animate-spin" />
                          ) : (
                            <IconDelete size={14} />
                          )}
                        </button>
                      ) : (
                        <span className="text-[10px] text-text-secondary/50 font-normal select-none" title="Для видалення видаліть первинний продаж/ремонт/закупівлю">Системна</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-text-secondary">
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

      {/* Transaction Detail Drawer */}
      <Drawer isOpen={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} title="Деталі фінансової операції" size="default">
        {selectedTransaction && (
          <div className="space-y-6 text-xs p-1">
            {/* Top Summary Card */}
            <div className="rounded-2xl bg-violet/5 border border-violet/10 p-5 flex justify-between items-center">
              <div>
                <p className="text-text-secondary">Транзакція</p>
                <p className="text-sm font-mono font-bold text-text-primary mt-1">#{selectedTransaction.id.substring(0, 8)}</p>
              </div>
              <div className="text-right">
                <p className="text-text-secondary">Сума операції</p>
                <p className="text-lg font-extrabold text-violet mt-1">{selectedTransaction.amount.toLocaleString()} ₴</p>
              </div>
            </div>

            {/* Details Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Main Info */}
              <div className="card p-5 space-y-3">
                <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 font-medium">Загальна інформація</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary">Тип:</span>
                    <span
                      className="rounded-lg px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: `color-mix(in oklch, ${typeColors[selectedTransaction.type] ?? "var(--color-iris)"} 18%, transparent)`,
                        color: typeColors[selectedTransaction.type] ?? "var(--color-iris)",
                      }}
                    >
                      {typeLabels[selectedTransaction.type] ?? selectedTransaction.type}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary">Дата створення:</span>
                    <span className="font-medium text-text-primary">{selectedTransaction.date}</span>
                  </div>
                </div>
              </div>

              {/* Route of Funds */}
              <div className="card p-5 space-y-3">
                <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 font-medium">Маршрут коштів</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary">Звідки (Відправник):</span>
                    <span className="font-semibold text-text-primary">{selectedTransaction.from}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary">Куди (Отримувач):</span>
                    <span className="font-semibold text-text-primary">{selectedTransaction.to}</span>
                  </div>
                </div>
              </div>

              {/* Description Card */}
              {selectedTransaction.description && (
                <div className="card p-5 space-y-3 md:col-span-2">
                  <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 font-medium">Опис операції</h4>
                  <p className="text-text-secondary leading-relaxed bg-warm-bg rounded-xl p-3 border border-warm-border/50 text-xs">
                    {selectedTransaction.description}
                  </p>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            <div className="card p-5 border border-rose/20 bg-rose/[0.02] flex justify-between items-center">
              <div>
                <p className="font-semibold text-rose text-sm">Небезпечна зона</p>
                <p className="text-[10px] text-text-secondary mt-0.5">Повне анулювання операції та коригування балансів</p>
              </div>
              <button
                disabled={deletingId === selectedTransaction.id}
                onClick={() => handleDeleteTransaction(selectedTransaction.id)}
                className="btn-press rounded-xl bg-rose hover:bg-rose/90 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {deletingId === selectedTransaction.id ? (
                  <>
                    <IconSpinner size={14} className="animate-spin" />
                    Видалення...
                  </>
                ) : (
                  <>
                    <IconDelete size={14} />
                    Видалити транзакцію
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
