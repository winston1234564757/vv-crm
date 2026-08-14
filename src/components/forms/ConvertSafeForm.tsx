"use client";

import { useActionState, useEffect, useState } from "react";
import { convertSafeHalvesAction, createTransfer } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";
import { uah } from "@/lib/utils/money";

interface Safe {
  id: string;
  name: string;
  type: string;
  balance: number;
  cashBalance: number;
  cardBalance: number;
}

interface CashRegister {
  id: string;
  name: string;
  type: string;
  balance: number;
}

type Direction = "cash_to_card" | "card_to_cash";

const initialState = { success: false, error: "" };

const DIRECTIONS: { key: Direction; label: string; icon: string }[] = [
  { key: "card_to_cash", label: "Карта → Готівка", icon: "💵" },
  { key: "cash_to_card", label: "Готівка → Карта", icon: "💳" },
];

/** Безготівкова каса — єдиний вид без готівки, лише картка */
type SourceKind = "safe" | "cashless_register";

interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  cashBalance: number;   // для сейфа — balance_cash; для каси — 0
  cardBalance: number;   // для сейфа — balance_cashless; для каси — balance
}

export function ConvertSafeForm({
  safes,
  cashRegisters,
  onSuccess,
}: {
  safes: Safe[];
  /** Всі готівкові каси — куди перекидати з безготівки */
  cashRegisters: CashRegister[];
  onSuccess: () => void;
}) {
  const [safeState, safeAction, safePending] = useActionState(convertSafeHalvesAction, initialState);
  const [transferState, transferAction, transferPending] = useActionState(createTransfer, initialState);

  const [sourceId, setSourceId] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("card_to_cash");
  const [amount, setAmount] = useState<string>("");
  const [toRegisterId, setToRegisterId] = useState<string>("");

  const pending = safePending || transferPending;
  const state = safeState.error ? safeState : transferState;

  useEffect(() => {
    if (safeState.success || transferState.success) onSuccess();
  }, [safeState.success, transferState.success, onSuccess]);

  // Всі джерела: спочатку безготівкова каса, потім сейфи
  const cashlessRegisters = cashRegisters.filter((r) => r.type === "cashless");
  const physicalRegisters = cashRegisters.filter((r) => r.type !== "cashless");

  const sources: Source[] = [
    ...cashlessRegisters.map((r) => ({
      id: r.id,
      name: r.name,
      kind: "cashless_register" as const,
      cashBalance: 0,
      cardBalance: r.balance,
    })),
    ...safes.map((s) => ({
      id: s.id,
      name: s.name,
      kind: "safe" as const,
      cashBalance: s.cashBalance,
      cardBalance: s.cardBalance,
    })),
  ];

  const selectedSource = sources.find((s) => s.id === sourceId);
  const isCashlessReg = selectedSource?.kind === "cashless_register";

  const amountNum = parseFloat(amount) || 0;

  // Для безготівкової каси — завжди card_to_cash
  const effectiveDirection: Direction = isCashlessReg ? "card_to_cash" : direction;

  const availableHalf = selectedSource
    ? effectiveDirection === "card_to_cash"
      ? selectedSource.cardBalance
      : selectedSource.cashBalance
    : null;

  const hasOverdraft = availableHalf !== null && amountNum > availableHalf;

  const selectedToRegister = physicalRegisters.find((r) => r.id === toRegisterId);
  const canSubmit =
    !!sourceId &&
    !!amount &&
    !hasOverdraft &&
    !pending &&
    // для cashless_register — ще треба обрати куди
    (!isCashlessReg || !!toRegisterId);

  // Безготівкова каса → готівкова каса: використовуємо transfer_funds
  if (isCashlessReg) {
    return (
      <form action={transferAction} className="space-y-5 p-5">
        {state.error && (
          <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>
        )}

        {/* Прихований напрямок: завжди cashless_register → cash_register */}
        <input type="hidden" name="from_type" value="cash_register" />
        <input type="hidden" name="from_id" value={sourceId} />
        <input type="hidden" name="to_type" value="cash_register" />
        <input type="hidden" name="to_id" value={toRegisterId} />
        <input type="hidden" name="payment_method" value="cash" />

        {/* Інформаційний блок — звідки */}
        <div className="rounded-xl border border-border bg-surface p-3 text-xs">
          <p className="mb-0.5 uppercase tracking-wide text-faint">Обналічення з</p>
          <div className="flex items-center justify-between">
            <p
              className="cursor-pointer font-medium text-ink underline decoration-dashed underline-offset-2"
              onClick={() => setSourceId("")}
            >
              {selectedSource?.name} ↗
            </p>
            <p className="tabular font-semibold text-ink">{uah(selectedSource?.cardBalance ?? 0)}</p>
          </div>
          <p className="mt-1 text-faint">натисни на назву щоб змінити джерело</p>
        </div>

        {/* Куди (готівкова каса) */}
        <div>
          <label htmlFor="to_register_select" className="mb-1.5 block text-xs font-medium text-muted">
            Куди (готівкова каса)
          </label>
          <select
            id="to_register_select"
            required
            value={toRegisterId}
            onChange={(e) => setToRegisterId(e.target.value)}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
          >
            <option value="" disabled>Оберіть касу...</option>
            {physicalRegisters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.balance.toLocaleString()} грн)
              </option>
            ))}
          </select>
        </div>

        {/* Сума */}
        <Input
          label="Сума обналічення (грн)"
          name="amount"
          type="number"
          min="1"
          max={selectedSource?.cardBalance ?? undefined}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000"
          error={hasOverdraft ? `Недостатньо. Доступно ${availableHalf?.toLocaleString()} грн` : undefined}
        />

        {/* Призначення */}
        <div>
          <label htmlFor="convert_description" className="mb-1.5 block text-xs font-medium text-muted">
            Призначення (опціонально)
          </label>
          <textarea
            id="convert_description"
            name="description"
            rows={2}
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
            placeholder="Напр. Інкасація, видача зарплати готівкою..."
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-press mt-2 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
        >
          {pending ? "Виконання..." : "💵 Обналічити"}
        </button>
      </form>
    );
  }

  // Сейф → конвертація між половинами
  return (
    <form action={safeAction} className="space-y-5 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose">{state.error}</div>
      )}

      {/* Напрямок */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Напрямок</p>
        <input type="hidden" name="direction" value={direction} />
        <div role="group" aria-label="Напрямок конвертації" className="grid grid-cols-2 gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => { setDirection(d.key); setAmount(""); }}
              aria-pressed={direction === d.key}
              className={[
                "flex flex-col items-center gap-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                direction === d.key
                  ? "border-violet bg-violet/10 text-violet"
                  : "border-border bg-transparent text-muted hover:border-violet/40 hover:text-ink",
              ].join(" ")}
            >
              <span className="text-xl">{d.icon}</span>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Вибір сейфу */}
      <div>
        <label htmlFor="convert_safe_select" className="mb-1.5 block text-xs font-medium text-muted">
          Сейф або безготівкова каса
        </label>
        <select
          id="convert_safe_select"
          required
          value={sourceId}
          onChange={(e) => { setSourceId(e.target.value); setAmount(""); }}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>Оберіть джерело...</option>
          {cashlessRegisters.length > 0 && (
            <optgroup label="Безготівкова каса">
              {cashlessRegisters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — на картці: {r.balance.toLocaleString()} грн
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Сейфи">
            {safes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (готівка: {s.cashBalance.toLocaleString()} · карта: {s.cardBalance.toLocaleString()})
              </option>
            ))}
          </optgroup>
        </select>
        <input type="hidden" name="safe_id" value={sourceId} />
      </div>

      {/* Баланс */}
      {selectedSource && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-3 text-xs">
          <div className={direction === "card_to_cash" ? "font-semibold text-ink" : "text-muted"}>
            <p className="mb-0.5 uppercase tracking-wide text-faint">Карта (джерело)</p>
            <p className="text-base tabular">{uah(selectedSource.cardBalance)}</p>
          </div>
          <div className={direction === "cash_to_card" ? "font-semibold text-ink" : "text-muted"}>
            <p className="mb-0.5 uppercase tracking-wide text-faint">Готівка (джерело)</p>
            <p className="text-base tabular">{uah(selectedSource.cashBalance)}</p>
          </div>
        </div>
      )}

      {/* Сума */}
      <Input
        label={`Сума (грн)`}
        name="amount"
        type="number"
        min="1"
        max={availableHalf ?? undefined}
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="1000"
        error={hasOverdraft ? `Недостатньо. Доступно ${availableHalf?.toLocaleString()} грн` : undefined}
      />

      {/* Призначення */}
      <div>
        <label htmlFor="convert_description_safe" className="mb-1.5 block text-xs font-medium text-muted">
          Призначення (опціонально)
        </label>
        <textarea
          id="convert_description_safe"
          name="description"
          rows={2}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Напр. Поповнення розрахункового рахунку..."
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-press mt-2 w-full rounded-xl bg-violet py-3.5 text-sm font-medium text-white transition-colors hover:bg-violet-hover disabled:opacity-50"
      >
        {pending
          ? "Виконання..."
          : direction === "card_to_cash"
          ? "💵 Обналічити"
          : "💳 Закинути на карту"}
      </button>
    </form>
  );
}
