"use client";

import { useState } from "react";
import { FieldLabel, fieldClass, fieldTone } from "@/components/ui/Input";
import { cn } from "@/lib/utils/cn";

/**
 * Звідки платимо: сейф або рахунок.
 *
 * Доти кожна грошова форма мала власний `<select>` із самими сейфами, а гроші
 * на рахунку «Безготівка» витратити було неможливо — спершу переказ у сейф,
 * потім оплата з його безготівкової половини. Два записи в реєстрі там, де
 * подія одна.
 *
 * Готівкові каси сюди НЕ потрапляють свідомо. З них рахуються частки сейфів
 * (Тех/Акс/Рем), і витрата повз розподіл зменшила б базу, з якої ті відсотки
 * беруться. Безготівковий рахунок у розподілі не бере участі, тож платити з
 * нього прямо — безпечно.
 *
 * Компонент шле `source_type` і `source_id` — рівно ту пару, яку тепер чекають
 * усі RPC. Плюс `legacyName` для сумісності: серверні дії, які ще читають
 * `paid_from_safe_id`, отримують id ЛИШЕ коли обрано сейф, і порожньо, коли
 * касу. Так старий код не отримує id каси в поле з FK на `safes`.
 */

export interface SourceAccount {
  id: string;
  name: string;
  balance: number;
  type: string;
}

export interface ChosenSource {
  type: "safe" | "cash_register";
  id: string;
  /** Каса диктує спосіб оплати. */
  method: "cash" | "cashless" | null;
  name: string;
}

export function PaymentSourcePicker({
  safes = [],
  registers = [],
  label = "Звідки платимо",
  legacyName,
  excludeSafeTypes = [],
  value,
  onChange,
}: {
  safes?: SourceAccount[];
  registers: SourceAccount[];
  label?: string;
  /** Ім'я поля, яке досі читає серверна дія (`paid_from_safe_id`, `safe_id`). */
  legacyName?: string;
  excludeSafeTypes?: string[];
  value?: ChosenSource | null;
  onChange?: (v: ChosenSource) => void;
}) {
  // Джерелами коштів є виключно фізичні каси та безготівковий рахунок (без рудиментних сейфів)
  const options: ChosenSource[] = registers.map((r) => ({
    type: "cash_register" as const,
    id: r.id,
    method: (r.type === "cashless" ? "cashless" : "cash") as "cash" | "cashless",
    name: r.name,
  }));

  const balances = new Map<string, number>(
    registers.map((r) => [r.id, r.balance] as const),
  );

  const [internal, setInternal] = useState<ChosenSource | null>(options[0] ?? null);
  const chosen = value !== undefined ? value : internal;

  const pick = (id: string) => {
    const next = options.find((o) => o.id === id);
    if (!next) return;
    setInternal(next);
    onChange?.(next);
  };

  return (
    <div>
      <FieldLabel htmlFor="payment-source">{label}</FieldLabel>
      <input type="hidden" name="source_type" value={chosen?.type ?? "cash_register"} />
      <input type="hidden" name="source_id" value={chosen?.id ?? ""} />
      {legacyName && (
        <input
          type="hidden"
          name={legacyName}
          value={chosen?.id ?? ""}
        />
      )}
      <select
        id="payment-source"
        value={chosen?.id ?? ""}
        onChange={(e) => pick(e.target.value)}
        className={cn(fieldClass, fieldTone(false))}
      >
        {options.length === 0 && <option value="">Немає доступних рахунків</option>}
        {options.map((o) => {
          const bal = balances.get(o.id) ?? 0;
          const isCard = o.method === "cashless";
          return (
            <option key={o.id} value={o.id}>
              {isCard ? "💳 Безготівка" : "💵 Готівка"} · {o.name} ({bal.toLocaleString("uk-UA")} ₴)
            </option>
          );
        })}
      </select>
      {chosen?.method && (
        <p className="mt-1.5 text-xs text-faint">
          Спосіб списання — {chosen.method === "cashless" ? "безготівковий" : "готівковий"}.
        </p>
      )}
    </div>
  );
}

/** Доступні каси для оплати — повертає всі доступні фізичні каси (готівка + безготівка). */
export function spendableRegisters<T extends { type: string }>(registers: T[]): T[] {
  return registers;
}
