"use client";

import { useActionState, useEffect, useState } from "react";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { withdrawOwnerShareAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";
import { uah } from "@/lib/utils/money";

interface RegisterOption {
  id: string;
  name: string;
  type: string;
  balance: number;
}

const initialState = { success: false, error: "" };

export function WithdrawShareForm({
  profitFund = 0,
  cashRegisters = [],
  onSuccess,
}: {
  profitFund?: number;
  cashRegisters?: RegisterOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(withdrawOwnerShareAction, initialState);

  const [method, setMethod] = useState<"cash" | "cashless">("cash");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  // Підбираємо касу під обраний спосіб (готівка чи безготівка)
  const matchingRegisters = cashRegisters.filter((r) =>
    method === "cashless" ? r.type === "cashless" : r.type !== "cashless"
  );
  const defaultRegister = matchingRegisters[0];
  const [selectedRegisterId, setSelectedRegisterId] = useState(defaultRegister?.id || "");

  useEffect(() => {
    if (matchingRegisters.length > 0) {
      setSelectedRegisterId(matchingRegisters[0].id);
    } else {
      setSelectedRegisterId("");
    }
  }, [method]);

  const activeRegister = cashRegisters.find((r) => r.id === selectedRegisterId);
  const totalPhysicalCash = cashRegisters.reduce((s, r) => s + (r.balance || 0), 0);
  const maxWithdrawableNow = Math.max(0, Math.min(profitFund, totalPhysicalCash));
  const amountNum = parseFloat(amount) || 0;
  const exceedsProfit = amountNum > profitFund;
  const exceedsCash = activeRegister ? amountNum > activeRegister.balance : false;
  const isInvalid = amountNum <= 0 || exceedsProfit || exceedsCash;

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      {/* Показник доступного прибутку */}
      <div className="rounded-2xl border border-emerald/20 bg-emerald/5 p-4 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-text-secondary">Нарахований чистий прибуток:</p>
          <p className="text-xl font-bold tabular text-emerald">{uah(profitFund)}</p>
        </div>
        <div className="flex items-baseline justify-between gap-2 border-t border-emerald/15 pt-2">
          <p className="text-xs font-medium text-text-primary">Фізично доступно в касах зараз:</p>
          <p className="text-base font-bold tabular text-text-primary">{uah(maxWithdrawableNow)}</p>
        </div>
        {profitFund > totalPhysicalCash && (
          <p className="text-[11px] text-text-secondary leading-relaxed">
            💡 Різниця ({uah(profitFund - totalPhysicalCash)}) тимчасово вкладена в закупівлю запчастин/товару і
            повернеться в касу з наступних продажів.
          </p>
        )}
      </div>

      <input type="hidden" name="source_id" value={selectedRegisterId} />
      <input type="hidden" name="payment_method" value={method} />

      {/* Вибір методу: Готівка чи Безготівка */}
      <div className="space-y-1.5">
        <PaymentMethodPicker
          value={method}
          onChange={(m) => setMethod(m)}
          label="Звідки фізично забираємо гроші:"
        />
      </div>

      {/* Вибір каси, якщо є вибір */}
      {matchingRegisters.length > 1 && (
        <div>
          <label htmlFor="reg_select" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Оберіть касу:
          </label>
          <select
            id="reg_select"
            value={selectedRegisterId}
            onChange={(e) => setSelectedRegisterId(e.target.value)}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
          >
            {matchingRegisters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (баланс: {uah(r.balance)})
              </option>
            ))}
          </select>
        </div>
      )}

      {activeRegister && (
        <p className="text-[11px] text-text-secondary">
          Баланс обраного рахунку ({activeRegister.name}):{" "}
          <span className="font-semibold text-text-primary">{uah(activeRegister.balance)}</span>
        </p>
      )}

      {/* Сума вилучення */}
      <div>
        <Input
          label="Сума вилучення (грн)"
          name="amount"
          type="number"
          min="1"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Напр. 2000"
          error={
            exceedsProfit
              ? `Сума перевищує нарахований прибуток (${uah(profitFund)})`
              : exceedsCash
              ? `Сума перевищує баланс обраного рахунку (${uah(activeRegister?.balance || 0)})`
              : undefined
          }
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Коментар (опціонально)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Виплата дивідендів..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || isInvalid || !selectedRegisterId}
        className="btn-press mt-4 w-full rounded-xl bg-emerald py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald/90 disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Вилучення..." : "Зняти чистий прибуток"}
      </button>
    </form>
  );
}
