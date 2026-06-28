"use client";

import { useState, useEffect } from "react";
import Drawer from "@/components/ui/Drawer";
import { SaleDetailView } from "@/components/SaleDetailView";
import { RepairDetailView } from "@/components/RepairDetailView";
import { EditRepairForm } from "@/components/forms/EditRepairForm";
import { PurchaseDetailView } from "@/components/PurchaseDetailView";
import { useRouter } from "next/navigation";
import { IconSpinner, IconDelete, IconBox, IconDevice, IconAccessory, IconWarning } from "@/components/icons";
import { deleteTransactionAction } from "@/lib/actions/finance";
import { createClient } from "@/lib/supabase/client";

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
  const [relatedEntity, setRelatedEntity] = useState<{
    loading: boolean;
    data: any;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!selectedTransaction || !selectedTransaction.reference_type || !selectedTransaction.reference_id) {
      setRelatedEntity(null);
      return;
    }

    const refType = selectedTransaction.reference_type;
    const refId = selectedTransaction.reference_id;
    const allowedTypes = ["device", "accessory", "part", "expense"];

    if (!allowedTypes.includes(refType)) {
      setRelatedEntity(null);
      return;
    }

    let isMounted = true;
    setRelatedEntity({ loading: true, data: null, error: null });

    const supabase = createClient();

    async function fetchRelated() {
      try {
        let table = "";
        let selectStr = "*";
        if (refType === "device") {
          table = "devices";
        } else if (refType === "accessory") {
          table = "accessories";
        } else if (refType === "part") {
          table = "parts";
          selectStr = "*, suppliers(name)";
        } else if (refType === "expense") {
          table = "expenses";
          selectStr = "*, expense_categories(name)";
        }

        if (!table) return;

        const { data, error } = await supabase
          .from(table as any)
          .select(selectStr)
          .eq("id", refId)
          .single();

        if (error) throw error;

        if (isMounted) {
          setRelatedEntity({ loading: false, data, error: null });
        }
      } catch (err: any) {
        console.error("Error fetching related entity:", err);
        if (isMounted) {
          setRelatedEntity({ 
            loading: false, 
            data: null, 
            error: err.message || "Не вдалося завантажити деталі" 
          });
        }
      }
    }

    fetchRelated();

    return () => {
      isMounted = false;
    };
  }, [selectedTransaction]);

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
        return;
      }
    } else if (t.reference_type === "repair_payment") {
      const repair = repairs.find((r) => r.id === t.reference_id);
      if (repair) {
        setSelectedRepair(repair);
        return;
      }
    } else if (t.reference_type === "purchase") {
      const purchase = purchases.find((p) => p.id === t.reference_id);
      if (purchase) {
        setSelectedPurchase(purchase);
        return;
      }
    }

    setSelectedTransaction(t);
  }

  return (
    <>
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary text-balance tracking-tight">Рух коштів</h2>
        <div className="mt-4">
          {/* Мобільні картки транзакцій */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {transactions.length === 0 ? (
              <p className="py-12 text-center text-sm text-text-secondary">Немає транзакцій</p>
            ) : (
              transactions.map((t) => {
                const hasRef = !!t.reference_type && !!t.reference_id;
                const isSystem = t.reference_type && ["sale", "repair_payment", "purchase"].includes(t.reference_type);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleRowClick(t)}
                    className={`rounded-2xl border border-warm-border p-4 bg-white shadow-sm flex flex-col gap-2.5 transition-colors ${
                      hasRef
                        ? "cursor-pointer border-violet/20 hover:border-violet/40 bg-violet/[0.01]"
                        : "hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-text-secondary font-mono">{t.date}</span>
                        {hasRef && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet" title="Пов'язана транзакція" />
                        )}
                      </div>
                      <span
                        className="rounded-lg px-2 py-0.5 text-[10px] font-medium uppercase"
                        style={{
                          background: `color-mix(in oklch, ${
                            typeColors[t.type] ?? "var(--color-iris)"
                          } 18%, transparent)`,
                          color: typeColors[t.type] ?? "var(--color-iris)",
                        }}
                      >
                        {typeLabels[t.type] ?? t.type}
                      </span>
                    </div>

                    <div className="text-xs text-text-secondary flex flex-col gap-1 border-t border-slate-100/60 pt-2.5">
                      <div className="flex justify-between">
                        <span>Від:</span>
                        <span className="text-text-primary font-medium">{t.from || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>До:</span>
                        <span className="text-text-primary font-semibold">{t.to}</span>
                      </div>
                    </div>

                    {t.description && (
                      <p className="text-xxs text-text-secondary bg-warm-surface p-2 rounded-lg border border-warm-border/60 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100/60 pt-2.5 text-xs">
                      <span className="font-bold text-text-primary text-sm">{t.amount.toLocaleString()} грн</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        {!isSystem ? (
                          <button
                            disabled={deletingId === t.id}
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="text-rose hover:text-rose/85 disabled:opacity-50 p-2 cursor-pointer transition-colors inline-flex items-center justify-center rounded-xl bg-rose/5 hover:bg-rose/10"
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
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Десктопна таблиця */}
          <div className="hidden md:block overflow-x-auto">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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

              {/* Related Entity Details */}
              {selectedTransaction.reference_type && ["device", "accessory", "part", "expense"].includes(selectedTransaction.reference_type) && relatedEntity && (
                <div className="md:col-span-2">
                  {relatedEntity.loading ? (
                    <div className="card p-5 flex items-center justify-center gap-2 text-text-secondary">
                      <IconSpinner size={16} className="animate-spin text-violet" />
                      <span>Завантаження деталей об'єкта...</span>
                    </div>
                  ) : relatedEntity.error ? (
                    <div className="card p-5 border border-rose/20 bg-rose/[0.01] text-rose flex items-center gap-2">
                      <IconWarning size={16} />
                      <span>{relatedEntity.error}</span>
                    </div>
                  ) : relatedEntity.data ? (
                    renderRelatedEntityCard(selectedTransaction.reference_type, relatedEntity.data)
                  ) : null}
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

function renderRelatedEntityCard(type: string, data: any) {
  if (type === "part") {
    const isLowStock = data.stock <= data.min_stock;
    return (
      <div className="card p-5 space-y-3 border-l-4 border-l-cyan bg-cyan/[0.01]">
        <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 flex items-center gap-1.5 font-medium">
          <span className="text-cyan flex items-center"><IconBox size={14} /></span>
          Закуплена деталь (Інвентар)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-text-secondary">Назва деталі:</p>
            <p className="font-bold text-text-primary text-sm mt-0.5">{data.name}</p>
          </div>
          {data.compatible_with && (
            <div>
              <p className="text-text-secondary">Сумісність:</p>
              <p className="font-medium text-text-primary mt-0.5">{data.compatible_with}</p>
            </div>
          )}
          <div>
            <p className="text-text-secondary">Собівартість:</p>
            <p className="font-semibold text-text-primary mt-0.5">{(data.cost_price ?? 0).toLocaleString()} ₴</p>
          </div>
          <div>
            <p className="text-text-secondary">Поточний склад:</p>
            <p className={`font-semibold mt-0.5 flex items-center gap-1.5 ${isLowStock ? 'text-rose' : 'text-emerald'}`}>
              {isLowStock && <IconWarning size={12} />}
              {data.stock} шт. (мін: {data.min_stock} шт.)
            </p>
          </div>
          {data.suppliers?.name && (
            <div>
              <p className="text-text-secondary">Постачальник:</p>
              <p className="font-medium text-text-primary mt-0.5">{data.suppliers.name}</p>
            </div>
          )}
          {data.part_number && (
            <div>
              <p className="text-text-secondary">Артикул:</p>
              <p className="font-mono text-text-primary mt-0.5">{data.part_number}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "device") {
    return (
      <div className="card p-5 space-y-3 border-l-4 border-l-violet bg-violet/[0.01]">
        <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 flex items-center gap-1.5 font-medium">
          <span className="text-violet flex items-center"><IconDevice size={14} /></span>
          Закуплений пристрій (Інвентар)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-text-secondary">Модель пристрою:</p>
            <p className="font-bold text-text-primary text-sm mt-0.5">{data.name}</p>
          </div>
          {data.serial_number && (
            <div>
              <p className="text-text-secondary">Серійний номер (S/N):</p>
              <p className="font-mono text-text-primary mt-0.5">{data.serial_number}</p>
            </div>
          )}
          <div>
            <p className="text-text-secondary">Собівартість:</p>
            <p className="font-semibold text-text-primary mt-0.5">{(data.cost_price ?? 0).toLocaleString()} ₴</p>
          </div>
          {data.price && (
            <div>
              <p className="text-text-secondary">Ціна продажу:</p>
              <p className="font-semibold text-text-primary mt-0.5">{(data.price ?? 0).toLocaleString()} ₴</p>
            </div>
          )}
          <div>
            <p className="text-text-secondary">Статус:</p>
            <span className="inline-block mt-1 rounded bg-violet/5 px-2 py-0.5 text-[10px] font-mono text-violet font-semibold uppercase">
              {data.status}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "accessory") {
    const isLowStock = data.stock <= data.min_stock;
    return (
      <div className="card p-5 space-y-3 border-l-4 border-l-amber bg-amber/[0.01]">
        <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 flex items-center gap-1.5 font-medium">
          <span className="text-amber flex items-center"><IconAccessory size={14} /></span>
          Закуплений аксесуар (Інвентар)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-text-secondary">Назва аксесуару:</p>
            <p className="font-bold text-text-primary text-sm mt-0.5">{data.name}</p>
          </div>
          {data.type && (
            <div>
              <p className="text-text-secondary">Тип:</p>
              <p className="font-medium text-text-primary mt-0.5">{data.type}</p>
            </div>
          )}
          <div>
            <p className="text-text-secondary">Собівартість:</p>
            <p className="font-semibold text-text-primary mt-0.5">{(data.cost_price ?? 0).toLocaleString()} ₴</p>
          </div>
          <div>
            <p className="text-text-secondary">Ціна продажу:</p>
            <p className="font-semibold text-text-primary mt-0.5">{(data.price ?? 0).toLocaleString()} ₴</p>
          </div>
          <div>
            <p className="text-text-secondary">Поточний склад:</p>
            <p className={`font-semibold mt-0.5 flex items-center gap-1.5 ${isLowStock ? 'text-rose' : 'text-emerald'}`}>
              {isLowStock && <IconWarning size={12} />}
              {data.stock} шт. (мін: {data.min_stock} шт.)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (type === "expense") {
    return (
      <div className="card p-5 space-y-3 border-l-4 border-l-rose bg-rose/[0.01]">
        <h4 className="font-semibold text-text-primary border-b border-warm-border pb-2 flex items-center gap-1.5 font-medium">
          📊 Деталі операційних витрат
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-text-secondary">Категорія витрати:</p>
            <p className="font-bold text-text-primary text-sm mt-0.5">
              {data.expense_categories?.name || "Невідомо"}
            </p>
          </div>
          {data.description && (
            <div className="sm:col-span-2">
              <p className="text-text-secondary">Опис витрати:</p>
              <p className="font-medium text-text-primary mt-0.5">{data.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
