"use client";

import { useEffect, useState, useTransition } from "react";
import { reconcileSaleWithMonobank } from "@/lib/actions/sales";
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
  const [bankTx, setBankTx] = useState<MonobankTransaction[]>([]);
  const [selectedSale, setSelectedSale] = useState<UnreconciledSale | null>(null);
  const [selectedBankTx, setSelectedBankTx] = useState<MonobankTransaction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBankTransactions = () => {
    let isMounted = true;
    fetch("/api/monobank")
      .then((res) => {
        if (!res.ok) throw new Error("Не вдалося завантажити виписку");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          // Filter transactions to show only positive amounts (incoming payments)
          const incoming = (data as MonobankTransaction[]).filter((tx) => tx.amount > 0);
          setBankTx(incoming);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Не вдалося завантажити виписку Monobank");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    fetchBankTransactions();
  }, []);

  async function handleReconcile() {
    if (!selectedSale || !selectedBankTx) return;
    setMessage(null);

    startTransition(async () => {
      const res = await reconcileSaleWithMonobank(selectedSale.id, selectedBankTx.id);
      if (res.success) {
        setMessage({ type: "success", text: "Платіж успішно зіставлено!" });
        // Remove from local lists
        setSales((prev) => prev.filter((s) => s.id !== selectedSale.id));
        setBankTx((prev) => prev.filter((tx) => tx.id !== selectedBankTx.id));
        setSelectedSale(null);
        setSelectedBankTx(null);
      } else {
        setMessage({ type: "error", text: res.error || "Не вдалося виконати зіставлення" });
      }
    });
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-warm-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Звірка безготівкових оплат (Monobank)</h2>
          <p className="text-xs text-text-secondary mt-0.5">Порівняйте надходження на рахунку з продажами в CRM</p>
        </div>
        {selectedSale && selectedBankTx && (
          <button
            onClick={handleReconcile}
            disabled={isPending}
            className="rounded-xl bg-violet px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50 btn-press"
          >
            {isPending ? "Зіставлення..." : "Зіставити вказані"}
          </button>
        )}
      </div>

      {message && (
        <div className={`rounded-xl p-3.5 text-xs ${message.type === "success" ? "bg-emerald/10 text-emerald border border-emerald/20" : "bg-rose/10 text-rose border border-rose/20"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Left column: Bank statements */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Надходження Monobank (виписка)
          </h3>
          {loading ? (
            <div className="space-y-2">
              <div className="h-14 rounded-xl bg-warm-bg animate-pulse" />
              <div className="h-14 rounded-xl bg-warm-bg animate-pulse" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-warm-border bg-warm-bg/50 p-4 text-xs text-text-secondary">
              Для підключення виписок налаштуйте токен <code className="font-mono bg-iris/5 px-1 py-0.5 rounded">MONOBANK_PERSONAL_TOKEN</code> в оточенні.
            </div>
          ) : bankTx.length === 0 ? (
            <div className="rounded-xl border border-warm-border p-4 text-xs text-text-secondary text-center">
              Немає нових безготівкових надходжень за останні 3 дні.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {bankTx.map((tx) => {
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
                        ? "border-violet bg-violet/5 ring-1 ring-violet"
                        : "border-warm-border bg-warm-bg/10 hover:bg-warm-bg/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">+{amountUah.toLocaleString()} грн</span>
                      <span className="text-[10px] text-text-secondary font-mono">{txTime}</span>
                    </div>
                    <p className="text-text-secondary text-[11px] mt-1 line-clamp-1">{tx.description}</p>
                    {tx.comment && (
                      <p className="text-[10px] text-violet font-medium mt-0.5 italic">Коментар: {tx.comment}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Unreconciled card sales */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Незвірені продажі в CRM
          </h3>
          {sales.length === 0 ? (
            <div className="rounded-xl border border-warm-border p-4 text-xs text-text-secondary text-center">
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
                        ? "border-violet bg-violet/5 ring-1 ring-violet"
                        : "border-warm-border bg-warm-bg/10 hover:bg-warm-bg/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">{sale.amount.toLocaleString()} грн</span>
                      <span className="text-[10px] text-text-secondary">{sale.date}</span>
                    </div>
                    <p className="text-text-primary font-medium text-[11px] mt-1">{sale.customer_name}</p>
                    <p className="text-text-secondary text-[10px] line-clamp-1 mt-0.5">{sale.notes}</p>
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
