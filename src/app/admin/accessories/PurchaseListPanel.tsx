"use client";

import { useState, useTransition, useMemo } from "react";
import Drawer from "@/components/ui/Drawer";
import { markAccessoriesOrdered, clearPurchaseOrder } from "@/lib/actions/accessories";
import { accessoryType, labelOf } from "@/lib/domain-labels";

type PurchaseItem = {
  id: string;
  name: string;
  type: string;
  stock: number;
  min_stock: number;
  supplier_sku: string | null;
  purchase_ordered_at: string | null;
  cost_price: number;
  price: number;
};

function formatOrderedDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function PurchaseListPanel({ items }: { items: PurchaseItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Кількість для замовлення: pre-fill = min_stock - stock, але ручне редагування
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, Math.max(i.min_stock - i.stock, 1)]))
  );

  // Синхронізуємо quantities якщо items змінились (revalidate)
  const syncedQuantities = useMemo(() => {
    const next = { ...quantities };
    for (const item of items) {
      if (!(item.id in next)) {
        next[item.id] = Math.max(item.min_stock - item.stock, 1);
      }
    }
    return next;
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderedItems = items.filter((i) => i.purchase_ordered_at !== null);
  const pendingItems = items.filter((i) => i.purchase_ordered_at === null);

  // Генерація тексту для itsellopt.ua: "SKU кількість" або "Назва кількість"
  function buildExportText(targetItems: PurchaseItem[]): string {
    return targetItems
      .map((item) => {
        const sku = item.supplier_sku?.trim() || item.name;
        const qty = syncedQuantities[item.id] ?? Math.max(item.min_stock - item.stock, 1);
        return `${sku} ${qty}`;
      })
      .join("\n");
  }

  async function handleCopy() {
    const text = buildExportText(pendingItems);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не вдалося скопіювати в буфер");
    }
  }

  function handleDownload() {
    const text = buildExportText(pendingItems);
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zamovlennya_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleMarkOrdered() {
    const ids = pendingItems.map((i) => i.id);
    if (!ids.length) return;
    setError("");
    startTransition(async () => {
      const res = await markAccessoriesOrdered(ids);
      if (!res.success) setError(res.error ?? "Помилка");
    });
  }

  function handleClearOrdered() {
    const ids = orderedItems.map((i) => i.id);
    if (!ids.length) return;
    setError("");
    startTransition(async () => {
      const res = await clearPurchaseOrder(ids);
      if (!res.success) setError(res.error ?? "Помилка");
    });
  }

  const badge = items.length;
  const hasPending = pendingItems.length > 0;

  return (
    <>
      {/* Кнопка з badge — завжди видима, якщо є товари для закупівлі */}
      <button
        id="purchase-list-btn"
        onClick={() => setIsOpen(true)}
        className="btn-press relative flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/5 px-4 py-2.5 text-sm font-medium text-amber transition-colors hover:bg-amber/10"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        Закупівля
        {badge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-white shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>

      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Список закупівлі"
        size="full"
      >
        <div className="flex h-full flex-col">
          {/* Помилка */}
          {error && (
            <div className="mx-4 mt-4 rounded-xl bg-rose/10 p-3 text-sm text-rose">
              {error}
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="text-4xl">✅</span>
              <p className="text-sm font-medium text-text-primary">Склад в нормі!</p>
              <p className="text-xs text-text-secondary">Всі аксесуари вище мінімального залишку</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Статистика */}
              <div className="grid grid-cols-3 gap-3 px-4 pt-4">
                <div className="rounded-xl bg-amber/5 border border-amber/20 p-3 text-center">
                  <p className="text-lg font-bold text-amber">{items.length}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">позицій</p>
                </div>
                <div className="rounded-xl bg-rose/5 border border-rose/20 p-3 text-center">
                  <p className="text-lg font-bold text-rose">{items.filter(i => i.stock === 0).length}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">відсутні</p>
                </div>
                <div className="rounded-xl bg-violet/5 border border-violet/20 p-3 text-center">
                  <p className="text-lg font-bold text-violet">{orderedItems.length}</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">замовлено</p>
                </div>
              </div>

              {/* Таблиця */}
              <div className="mt-4 flex-1 overflow-y-auto px-4">
                {/* Не замовлені (потребують замовлення) */}
                {pendingItems.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Потрібно замовити ({pendingItems.length})
                    </h3>
                    <div className="rounded-xl border border-warm-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-iris/5 text-xs text-text-secondary border-b border-warm-border">
                          <tr>
                            <th className="p-3 text-left">Назва</th>
                            <th className="p-3 text-right whitespace-nowrap">Залишок / Мін</th>
                            <th className="p-3 text-right whitespace-nowrap">SKU постач.</th>
                            <th className="p-3 text-right whitespace-nowrap">Замовити, шт</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingItems.map((item) => {
                            const isOut = item.stock === 0;
                            const qty = syncedQuantities[item.id] ?? Math.max(item.min_stock - item.stock, 1);
                            return (
                              <tr
                                key={item.id}
                                className="border-b border-warm-border/40 last:border-0 hover:bg-violet/[0.02]"
                              >
                                <td className="p-3">
                                  <p className="font-medium text-text-primary leading-tight">{item.name}</p>
                                  <p className="text-[10px] text-text-secondary mt-0.5">
                                    {labelOf(accessoryType, item.type).label}
                                  </p>
                                </td>
                                <td className="p-3 text-right whitespace-nowrap">
                                  <span className={`font-bold tabular-nums ${isOut ? "text-rose" : "text-amber"}`}>
                                    {item.stock}
                                  </span>
                                  <span className="text-text-muted text-xs"> / {item.min_stock}</span>
                                </td>
                                <td className="p-3 text-right">
                                  {item.supplier_sku ? (
                                    <span className="font-mono text-xs text-text-secondary bg-iris/5 px-2 py-0.5 rounded">
                                      {item.supplier_sku}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-text-muted italic">—</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) =>
                                      setQuantities((prev) => ({
                                        ...prev,
                                        [item.id]: Math.max(1, parseInt(e.target.value) || 1),
                                      }))
                                    }
                                    className="w-16 rounded-lg border border-warm-border bg-warm-surface px-2 py-1 text-right text-sm font-medium text-text-primary outline-none transition-colors focus:border-violet/40 tabular-nums"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Вже замовлені — очікують поповнення */}
                {orderedItems.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        Вже замовлено ({orderedItems.length})
                      </h3>
                      <button
                        onClick={handleClearOrdered}
                        disabled={isPending}
                        className="text-[10px] text-text-muted hover:text-rose transition-colors disabled:opacity-50"
                      >
                        Зняти позначку
                      </button>
                    </div>
                    <div className="rounded-xl border border-warm-border/50 overflow-hidden opacity-60">
                      <table className="w-full text-sm">
                        <tbody>
                          {orderedItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-warm-border/30 last:border-0 bg-violet/[0.01]"
                            >
                              <td className="p-3">
                                <p className="font-medium text-text-primary leading-tight line-through opacity-60">{item.name}</p>
                              </td>
                              <td className="p-3 text-right whitespace-nowrap text-xs text-text-muted">
                                {item.stock} / {item.min_stock}
                              </td>
                              <td className="p-3 text-right">
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-2 py-0.5 text-[10px] font-medium text-violet">
                                  ✓ замовлено {formatOrderedDate(item.purchase_ordered_at)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Підказка по формату */}
              {hasPending && (
                <div className="mx-4 mb-3 rounded-xl border border-iris/10 bg-iris/5 p-3 text-xs text-text-secondary">
                  <strong className="text-text-primary">Формат для itsellopt:</strong>{" "}
                  <span className="font-mono">SKU кількість</span> (по одному рядку).
                  {pendingItems.some((i) => !i.supplier_sku) && (
                    <span className="ml-1 text-amber">
                      ⚠ Деякі товари без SKU — буде підставлена назва.
                    </span>
                  )}
                </div>
              )}

              {/* Дії */}
              {hasPending && (
                <div className="flex flex-wrap gap-2 border-t border-warm-border p-4">
                  <button
                    id="purchase-copy-btn"
                    onClick={handleCopy}
                    className="btn-press flex items-center gap-2 rounded-xl border border-iris/20 px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-iris/5 hover:text-text-primary"
                  >
                    {copied ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Скопійовано!
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Копіювати список
                      </>
                    )}
                  </button>

                  <button
                    id="purchase-download-btn"
                    onClick={handleDownload}
                    className="btn-press flex items-center gap-2 rounded-xl border border-iris/20 px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-iris/5 hover:text-text-primary"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Завантажити TXT
                  </button>

                  <button
                    id="purchase-mark-ordered-btn"
                    onClick={handleMarkOrdered}
                    disabled={isPending}
                    className="btn-press ml-auto flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
                  >
                    {isPending ? (
                      <span className="animate-pulse opacity-60">Зачекайте...</span>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Позначити як замовлено
                      </>
                    )}
                  </button>
                </div>
              )}

              {!hasPending && orderedItems.length > 0 && (
                <div className="border-t border-warm-border p-4 text-center text-sm text-text-secondary">
                  Всі позиції вже замовлені. Список очиститься після поповнення складу.
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
