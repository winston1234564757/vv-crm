"use client";

import { useEffect, useState, useTransition } from "react";
import { reconcileSaleWithMonobank } from "@/lib/actions/sales";
import { useMonobankTransactions } from "@/lib/supabase/hooks/useMonobankTransactions";
import type { MonobankTransaction } from "@/lib/services/monobank";

type UnreconciledSale = {
  id: string;
  amount: number;
  date: string;
  notes: string;
  customer_name: string;
};

interface ReconciliationBenchProps {
  initialSales: UnreconciledSale[];
}

export default function ReconciliationBench({ initialSales }: ReconciliationBenchProps) {
  const [sales, setSales] = useState<UnreconciledSale[]>(initialSales);
  const [selectedSale, setSelectedSale] = useState<UnreconciledSale | null>(null);
  const [selectedBankTx, setSelectedBankTx] = useState<MonobankTransaction | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hiddenBankTxIds, setHiddenBankTxIds] = useState<Set<string>>(new Set());

  const { data: bankTxData, isLoading: loading, isError, error } = useMonobankTransactions();
  
  // Filter out bank transactions that were reconciled in this session
  const bankTx = (bankTxData || []).filter((tx: MonobankTransaction) => !hiddenBankTxIds.has(tx.id));

  async function handleReconcile() {
    if (!selectedSale || !selectedBankTx) return;
    setMessage(null);

    startTransition(async () => {
      const res = await reconcileSaleWithMonobank(selectedSale.id, selectedBankTx.id);
      if (res.success) {
        setMessage({ type: "success", text: "Платіж успішно зіставлено!" });
        // Remove from local lists
        setSales((prev) => prev.filter((s) => s.id !== selectedSale.id));
        setHiddenBankTxIds((prev) => new Set(prev).add(selectedBankTx.id));
        setSelectedSale(null);
        setSelectedBankTx(null);
      } else {
        setMessage({ type: "error", text: res.error || "Не вдалося виконати зіставлення" });
      }
    });
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-ink text-balance tracking-tight">Звірка безготівкових оплат (Monobank)</h2>
          <p className="text-xs text-muted mt-0.5">Порівняйте надходження на рахунку з продажами в CRM</p>
        </div>
        {selectedSale && selectedBankTx && (
          <button
            onClick={handleReconcile}
            disabled={isPending}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 btn-press"
          >
            {isPending ? "Зіставлення..." : "Зіставити вказані"}
          </button>
        )}
      </div>

      {message && (
        <div className={`rounded-xl p-3.5 text-xs ${message.type === "success" ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
        {/* Left column: Bank statements */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted tracking-tight">
            Надходження Monobank (виписка)
          </h3>
          {loading ? (
            <div className="space-y-2">
              <div className="h-14 rounded-xl bg-hover animate-pulse" />
              <div className="h-14 rounded-xl bg-hover animate-pulse" />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-border bg-hover p-4 text-xs text-muted">
              Для підключення виписок налаштуйте токен <code className="rounded bg-hover px-1 py-0.5">MONOBANK_PERSONAL_TOKEN</code> в оточенні.
              {error?.message && <div className="mt-2 text-danger">{error.message}</div>}
            </div>
          ) : bankTx.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-xs text-muted text-center">
              Немає нових безготівкових надходжень за останні 3 дні.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {bankTx.map((tx: MonobankTransaction) => {
                const amountUah = tx.amount / 100;
                const txTime = new Date(tx.time * 1000).toLocaleString("uk-UA", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const isSelected = selectedBankTx?.id === tx.id;
                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedBankTx(isSelected ? null : tx)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5 ring-1 ring-violet"
                        : "border-border bg-surface hover:bg-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">+{amountUah.toLocaleString()} грн</span>
                      <span className="text-[10px] text-muted">{txTime}</span>
                    </div>
                    <p className="text-muted text-[11px] mt-1 line-clamp-1">{tx.description}</p>
                    {tx.comment && (
                      <p className="text-[10px] text-accent-ink font-medium mt-0.5 italic">Коментар: {tx.comment}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Unreconciled card sales */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted tracking-tight">
            Незвірені продажі в CRM
          </h3>
          {sales.length === 0 ? (
            <div className="rounded-xl border border-border p-4 text-xs text-muted text-center">
              Усі безготівкові продажі успішно звірені та закриті!
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {sales.map((sale) => {
                const isSelected = selectedSale?.id === sale.id;
                return (
                  <div
                    key={sale.id}
                    onClick={() => setSelectedSale(isSelected ? null : sale)}
                    className={`rounded-xl border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5 ring-1 ring-violet"
                        : "border-border bg-surface hover:bg-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{sale.amount.toLocaleString()} грн</span>
                      <span className="text-[10px] text-muted">{sale.date}</span>
                    </div>
                    <p className="text-ink font-medium text-[11px] mt-1">{sale.customer_name}</p>
                    <p className="text-muted text-[10px] line-clamp-1 mt-0.5">{sale.notes}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
