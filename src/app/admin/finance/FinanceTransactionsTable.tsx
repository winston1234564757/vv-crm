"use client";

import { useState, useEffect, useMemo } from "react";
import Drawer from "@/components/ui/Drawer";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ListPageShell, type Column } from "@/components/list/ListPageShell";
import { useListQuery } from "@/components/list/useListQuery";
import { Toolbar, SearchField } from "@/components/ui/Toolbar";
import { Select } from "@/components/ui/Select";
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

/* Тони бейджа семантичні, а не декоративні: надходження — гроші прийшли,
   витрата — пішли, розподіл — переклали між своїми рахунками. Раніше тут була
   категоріальна палітра з інлайн-стилями (cyan / rose / violet), яка означала
   те саме, але повз дизайн-систему. */
const typeTones: Record<string, BadgeTone> = {
  sale: "success",
  expense: "danger",
  distribution: "neutral",
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

  /* Системну транзакцію не можна видалити звідси: вона лише відображає продаж,
     ремонт чи закупівлю, і зникнути має разом із першоджерелом. Правило одне
     на таблицю й на картку — раніше воно було переписане в обох місцях. */
  const isSystem = (t: TransactionRow) =>
    !!t.reference_type && ["sale", "repair_payment", "purchase"].includes(t.reference_type);
  const hasRef = (t: TransactionRow) => !!t.reference_type && !!t.reference_id;

  const query = useListQuery({ mode: "client", filters: { type: "all" } });

  const visible = useMemo(() => {
    const needle = query.search.trim().toLowerCase();
    const type = query.filters.type;

    return transactions.filter((t) => {
      if (type !== "all" && t.type !== type) return false;
      if (!needle) return true;
      return [t.from, t.to, t.description, String(t.amount)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [transactions, query.search, query.filters.type]);

  function DeleteCell({ t }: { t: TransactionRow }) {
    if (isSystem(t)) {
      return (
        <span
          className="select-none text-[10px] font-normal text-muted/50"
          title="Для видалення видаліть первинний продаж/ремонт/закупівлю"
        >
          Системна
        </span>
      );
    }
    return (
      <button
        disabled={deletingId === t.id}
        onClick={() => handleDeleteTransaction(t.id)}
        className="btn-press inline-flex cursor-pointer items-center justify-center rounded-[var(--radius-md)] p-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
        title="Видалити"
      >
        {deletingId === t.id ? (
          <IconSpinner size={14} className="animate-spin" />
        ) : (
          <IconDelete size={14} />
        )}
      </button>
    );
  }

  const columns: Column<TransactionRow>[] = [
    {
      key: "date",
      header: "Дата",
      cell: (t) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
          {t.date}
          {hasRef(t) && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
              title="Пов'язана сума"
            />
          )}
        </span>
      ),
    },
    { key: "from", header: "Від", cell: (t) => <span className="text-muted">{t.from || "—"}</span> },
    { key: "to", header: "До", cell: (t) => <span className="font-medium">{t.to}</span> },
    {
      key: "type",
      header: "Тип",
      cell: (t) => (
        <Badge tone={typeTones[t.type] ?? "neutral"}>{typeLabels[t.type] ?? t.type}</Badge>
      ),
    },
    {
      key: "description",
      header: "Опис",
      hideBelow: "lg",
      cell: (t) => (
        <span className="block max-w-[200px] truncate text-xs text-muted" title={t.description}>
          {t.description}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Сума",
      align: "right",
      cell: (t) => (
        <span className="whitespace-nowrap font-medium tabular">
          {t.amount.toLocaleString()} грн
        </span>
      ),
    },
    // `interactive` — оболонка сама ізолює клік, тож `stopPropagation` руками
    // тут більше не пишеться і рядок не відкриє шухляду замість видалення.
    { key: "actions", header: "", align: "right", interactive: true, cell: (t) => <DeleteCell t={t} /> },
  ];

  return (
    <>
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink text-balance tracking-tight">Рух коштів</h2>
        <div className="mt-4">
          <ListPageShell
            query={query}
            rows={visible}
            getRowId={(t) => t.id}
            columns={columns}
            onRowClick={handleRowClick}
            itemLabel="рухів"
            /* Пов'язаний рух підсвічується: по ньому є що відкрити. Раніше та
               сама умова була переписана окремо для таблиці й для картки. */
            rowClassName={(t) => (hasRef(t) ? "bg-accent/[0.03]" : undefined)}
            card={(t) => ({
              title: t.to,
              subtitle: t.from ? `від ${t.from}` : undefined,
              state: (
                <Badge tone={typeTones[t.type] ?? "neutral"}>
                  {typeLabels[t.type] ?? t.type}
                </Badge>
              ),
              rows: [
                { label: "Дата", value: t.date },
                { label: "Сума", value: `${t.amount.toLocaleString()} грн` },
                ...(t.description ? [{ label: "Опис", value: t.description }] : []),
              ],
              footer: <DeleteCell t={t} />,
            })}
            toolbar={
              <Toolbar
                search={
                  <SearchField
                    value={query.draftSearch}
                    onChange={(e) => query.setDraftSearch(e.target.value)}
                    onClear={query.clearSearch}
                    placeholder="Пошук за рахунком, описом, сумою"
                  />
                }
              >
                <Select
                  value={query.filters.type}
                  onChange={(e) => query.setFilter("type", e.target.value)}
                  inline
                  aria-label="Тип руху"
                >
                  <option value="all">Усі типи</option>
                  <option value="sale">Надходження</option>
                  <option value="expense">Витрата</option>
                  <option value="distribution">Розподіл</option>
                </Select>
              </Toolbar>
            }
            empty={{
              title: "Рухів коштів немає",
              description:
                "Тут з'являться продажі, витрати й розподіли — щойно перший рух пройде через касу або сейф.",
            }}
            noResults={{
              title: "Нічого не знайдено",
              description: "Спробуйте інший запит або зніміть фільтр типу.",
            }}
          />

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
            <div className="rounded-2xl bg-accent/5 border border-accent/10 p-5 flex justify-between items-center">
              <div>
                <p className="text-muted">Транзакція</p>
                <p className="text-sm font-semibold tabular text-ink mt-1">#{selectedTransaction.id.substring(0, 8)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted">Сума операції</p>
                <p className="text-lg font-extrabold text-accent-ink mt-1">{selectedTransaction.amount.toLocaleString()} ₴</p>
              </div>
            </div>

            {/* Details Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Main Info */}
              <div className="card p-5 space-y-3">
                <h4 className="font-semibold text-ink border-b border-border pb-2 font-medium">Загальна інформація</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Тип:</span>
                    <Badge tone={typeTones[selectedTransaction.type] ?? "neutral"}>
                      {typeLabels[selectedTransaction.type] ?? selectedTransaction.type}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Дата створення:</span>
                    <span className="font-medium text-ink">{selectedTransaction.date}</span>
                  </div>
                </div>
              </div>

              {/* Route of Funds */}
              <div className="card p-5 space-y-3">
                <h4 className="font-semibold text-ink border-b border-border pb-2 font-medium">Маршрут коштів</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Звідки (Відправник):</span>
                    <span className="font-semibold text-ink">{selectedTransaction.from}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Куди (Отримувач):</span>
                    <span className="font-semibold text-ink">{selectedTransaction.to}</span>
                  </div>
                </div>
              </div>

              {/* Description Card */}
              {selectedTransaction.description && (
                <div className="card p-5 space-y-3 md:col-span-2">
                  <h4 className="font-semibold text-ink border-b border-border pb-2 font-medium">Опис операції</h4>
                  <p className="text-muted leading-relaxed bg-hover rounded-xl p-3 border border-border/50 text-xs">
                    {selectedTransaction.description}
                  </p>
                </div>
              )}

              {/* Related Entity Details */}
              {selectedTransaction.reference_type && ["device", "accessory", "part", "expense"].includes(selectedTransaction.reference_type) && relatedEntity && (
                <div className="md:col-span-2">
                  {relatedEntity.loading ? (
                    <div className="card p-5 flex items-center justify-center gap-2 text-muted">
                      <IconSpinner size={16} className="animate-spin text-accent-ink" />
                      <span>Завантаження деталей об'єкта...</span>
                    </div>
                  ) : relatedEntity.error ? (
                    <div className="card p-5 border border-danger/20 bg-danger/[0.01] text-danger flex items-center gap-2">
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
            <div className="card p-5 border border-danger/20 bg-danger/[0.02] flex justify-between items-center">
              <div>
                <p className="font-semibold text-danger text-sm">Небезпечна зона</p>
                <p className="text-[10px] text-muted mt-0.5">Повне анулювання операції та коригування балансів</p>
              </div>
              <button
                disabled={deletingId === selectedTransaction.id}
                onClick={() => handleDeleteTransaction(selectedTransaction.id)}
                className="btn-press rounded-xl bg-danger hover:bg-danger/90 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
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
      <div className="card border border-border bg-surface p-5 space-y-3">
        <h4 className="font-semibold text-ink border-b border-border pb-2 flex items-center gap-1.5 font-medium">
          <span className="text-info flex items-center"><IconBox size={14} /></span>
          Закуплена деталь (Інвентар)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-muted">Назва деталі:</p>
            <p className="font-bold text-ink text-sm mt-0.5">{data.name}</p>
          </div>
          {data.compatible_with && (
            <div>
              <p className="text-muted">Сумісність:</p>
              <p className="font-medium text-ink mt-0.5">{data.compatible_with}</p>
            </div>
          )}
          <div>
            <p className="text-muted">Собівартість:</p>
            <p className="font-semibold text-ink mt-0.5">{(data.cost_price ?? 0).toLocaleString()} ₴</p>
          </div>
          <div>
            <p className="text-muted">Поточний склад:</p>
            <p className={`font-semibold mt-0.5 flex items-center gap-1.5 ${isLowStock ? 'text-danger' : 'text-success'}`}>
              {isLowStock && <IconWarning size={12} />}
              {data.stock} шт. (мін: {data.min_stock} шт.)
            </p>
          </div>
          {data.suppliers?.name && (
            <div>
              <p className="text-muted">Постачальник:</p>
              <p className="font-medium text-ink mt-0.5">{data.suppliers.name}</p>
            </div>
          )}
          {data.part_number && (
            <div>
              <p className="text-muted">Артикул:</p>
              <p className="tabular text-ink mt-0.5">{data.part_number}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "device") {
    return (
      <div className="card border border-border bg-surface p-5 space-y-3">
        <h4 className="font-semibold text-ink border-b border-border pb-2 flex items-center gap-1.5 font-medium">
          <span className="text-accent-ink flex items-center"><IconDevice size={14} /></span>
          Закуплений пристрій (Інвентар)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-muted">Модель пристрою:</p>
            <p className="font-bold text-ink text-sm mt-0.5">{data.name}</p>
          </div>
          {data.serial_number && (
            <div>
              <p className="text-muted">Серійний номер (S/N):</p>
              <p className="tabular text-ink mt-0.5">{data.serial_number}</p>
            </div>
          )}
          <div>
            <p className="text-muted">Собівартість:</p>
            <p className="font-semibold text-ink mt-0.5">{(data.cost_price ?? 0).toLocaleString()} ₴</p>
          </div>
          {data.price && (
            <div>
              <p className="text-muted">Ціна продажу:</p>
              <p className="font-semibold text-ink mt-0.5">{(data.price ?? 0).toLocaleString()} ₴</p>
            </div>
          )}
          <div>
            <p className="text-muted">Статус:</p>
            <span className="inline-block mt-1 rounded bg-accent/5 px-2 py-0.5 text-[10px] text-accent-ink font-semibold uppercase">
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
      <div className="card border border-border bg-surface p-5 space-y-3">
        <h4 className="font-semibold text-ink border-b border-border pb-2 flex items-center gap-1.5 font-medium">
          <span className="text-warning flex items-center"><IconAccessory size={14} /></span>
          Закуплений аксесуар (Інвентар)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-muted">Назва аксесуару:</p>
            <p className="font-bold text-ink text-sm mt-0.5">{data.name}</p>
          </div>
          {data.type && (
            <div>
              <p className="text-muted">Тип:</p>
              <p className="font-medium text-ink mt-0.5">{data.type}</p>
            </div>
          )}
          <div>
            <p className="text-muted">Собівартість:</p>
            <p className="font-semibold text-ink mt-0.5">{(data.cost_price ?? 0).toLocaleString()} ₴</p>
          </div>
          <div>
            <p className="text-muted">Ціна продажу:</p>
            <p className="font-semibold text-ink mt-0.5">{(data.price ?? 0).toLocaleString()} ₴</p>
          </div>
          <div>
            <p className="text-muted">Поточний склад:</p>
            <p className={`font-semibold mt-0.5 flex items-center gap-1.5 ${isLowStock ? 'text-danger' : 'text-success'}`}>
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
      <div className="card border border-border bg-surface p-5 space-y-3">
        <h4 className="font-semibold text-ink border-b border-border pb-2 flex items-center gap-1.5 font-medium">
          📊 Деталі операційних витрат
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <p className="text-muted">Категорія витрати:</p>
            <p className="font-bold text-ink text-sm mt-0.5">
              {data.expense_categories?.name || "Невідомо"}
            </p>
          </div>
          {data.description && (
            <div className="sm:col-span-2">
              <p className="text-muted">Опис витрати:</p>
              <p className="font-medium text-ink mt-0.5">{data.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
