"use client";

import { useActionState, useEffect, useState } from "react";
import { PaymentMethodPicker } from "@/components/ui/PaymentMethodPicker";
import { withdrawOwnerShareAction } from "@/lib/actions/finance";
import { Input } from "@/components/ui/Input";
import { uah } from "@/lib/utils/money";
import type { WithdrawSafe } from "@/app/admin/finance/WithdrawShareButton";

const initialState = { success: false, error: "" };

/** Скільки в сейфі саме тієї половини, якою забирають. */
function halfOf(safe: WithdrawSafe | undefined, method: "cash" | "cashless"): number {
  if (!safe) return 0;
  return Math.max(method === "cash" ? safe.cashBalance : safe.cardBalance, 0);
}

/**
 * Джерело частки завжди одне — сейф «Чистий прибуток». Раніше тут був вибір із
 * кас і сейфів, і частку регулярно брали з каси повз сейф; тоді залишок
 * власника розходився з тим, що в сейфі реально лежить. Селект лишився на
 * випадок кількох сейфів ЧП, але за замовчуванням підставляє єдиний.
 *
 * Коли суми в сейфі не вистачає, форма НЕ блокує вилучення, а пропонує добрати
 * різницю авансом з іншого сейфа. Було навпаки — кнопка просто гасла, і це
 * закінчилось тим, що 01.08 12 000 забрали повз перевірку, а сейф ЧП лишився
 * з мінусом −3 498, якого не буває. Заборона без легального шляху не спиняє
 * власника взяти свої гроші — вона лише робить це невидимим для системи.
 */
export function WithdrawShareForm({
  sources,
  advanceSources,
  onSuccess,
}: {
  sources: WithdrawSafe[];
  advanceSources: WithdrawSafe[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(withdrawOwnerShareAction, initialState);

  const [sourceId, setSourceId] = useState(sources.length === 1 ? sources[0].id : "");
  const [method, setMethod] = useState<"cash" | "cashless">("cash");
  const [amount, setAmount] = useState("");
  const [advanceSafeId, setAdvanceSafeId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  const selectedSource = sources.find((s) => s.id === sourceId);
  const available = halfOf(selectedSource, method);

  const amountNum = parseFloat(amount) || 0;
  const fromSafe = Math.min(amountNum, available);
  const advance = Math.max(amountNum - available, 0);

  const advanceSafe = advanceSources.find((s) => s.id === advanceSafeId);
  const advanceShort = advance > 0 && !!advanceSafe && halfOf(advanceSafe, method) < advance;
  const advanceMissing = advance > 0 && !advanceSafe;

  const methodWord = method === "cash" ? "готівкою" : "безготівкою";

  if (sources.length === 0) {
    return (
      <div className="p-5 text-sm text-text-secondary">
        Сейф «Чистий прибуток» не налаштований — частку знімати нема звідки.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 p-5">
      {state.error && (
        <div className="rounded-xl bg-rose/10 p-4 text-sm text-rose animate-entry">
          {state.error}
        </div>
      )}

      <input type="hidden" name="source_type" value="safe" />
      <input type="hidden" name="source_id" value={sourceId} />
      {/* Порожнє поле означає «аванс не потрібен» — сервер розбирає його як
          відсутній, а не як невалідний uuid. */}
      <input type="hidden" name="advance_safe_id" value={advance > 0 ? advanceSafeId : ""} />

      <div>
        <label htmlFor="source_select" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Джерело — сейф чистого прибутку
        </label>
        <select
          id="source_select"
          required
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
        >
          <option value="" disabled>
            Оберіть сейф...
          </option>
          {sources.map((src) => (
            <option key={src.id} value={src.id}>
              🔒 {src.name} ({src.balance.toLocaleString("uk-UA")} грн)
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-text-secondary/70">
          Частку беруть тільки звідси. Щоб гроші сюди потрапили — спершу розподіліть касу.
        </p>
      </div>

      <Input
        label="Сума вилучення частки (грн)"
        name="amount"
        type="number"
        min="1"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="600"
      />

      <PaymentMethodPicker label="Чим забрано" value={method} onChange={setMethod} />

      {selectedSource && (
        <p className="text-[11px] text-text-secondary/70">
          У сейфі «{selectedSource.name}» {uah(available)} {methodWord}.
        </p>
      )}

      {advance > 0 && (
        <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs text-text-primary">
            У сейфі не вистачає {uah(advance)}. Можна взяти їх{" "}
            <span className="font-semibold">авансом</span> з іншого сейфа.
          </p>
          <p className="text-[11px] text-text-secondary/80">
            Аванс — це гроші наперед. Вони зменшать твій залишок повністю, але базу
            нарахування не збільшать: сейфа чистого прибутку вони не бачили.
            {fromSafe > 0 && ` Записів буде два: ${uah(fromSafe)} часткою з ЧП і ${uah(advance)} авансом.`}
          </p>

          <div>
            <label
              htmlFor="advance_select"
              className="mb-1.5 block text-xs font-medium text-text-secondary"
            >
              Сейф, з якого взяти аванс
            </label>
            <select
              id="advance_select"
              value={advanceSafeId}
              onChange={(e) => setAdvanceSafeId(e.target.value)}
              className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
            >
              <option value="">Оберіть сейф...</option>
              {advanceSources.map((src) => (
                <option key={src.id} value={src.id}>
                  🔒 {src.name} ({halfOf(src, method).toLocaleString("uk-UA")} грн {methodWord})
                </option>
              ))}
            </select>
            {advanceShort && (
              <p className="mt-1.5 text-[11px] text-rose">
                У сейфі «{advanceSafe?.name}» лише {uah(halfOf(advanceSafe, method))} {methodWord} —
                на аванс не вистачить.
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="description" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Коментар / Примітка (опціонально)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet placeholder:text-text-secondary/30"
          placeholder="Наприклад: Вилучення частки прибутку за липень..."
        />
      </div>

      <button
        type="submit"
        disabled={pending || !sourceId || !amount || advanceMissing || advanceShort}
        className="btn-press mt-4 w-full rounded-xl bg-emerald py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald/90 disabled:opacity-50 cursor-pointer"
      >
        {pending
          ? "Збереження..."
          : advance > 0
            ? `💵 Виплатити, з них ${uah(advance)} авансом`
            : "💵 Виплатити частку прибутку"}
      </button>
    </form>
  );
}
