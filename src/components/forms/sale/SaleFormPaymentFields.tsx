"use client";

interface SaleFormPaymentFieldsProps {
  amount: string;
  onAmountChange: (val: string) => void;
  discount: number;
  isSplit: boolean;
  setIsSplit: (val: boolean) => void;
  cashAmount: string;
  onCashAmountChange: (val: string) => void;
  cardAmount: string;
  onCardAmountChange: (val: string) => void;
  remainingSplit: number;
}

export default function SaleFormPaymentFields({
  amount,
  onAmountChange,
  discount,
  isSplit,
  setIsSplit,
  cashAmount,
  onCashAmountChange,
  cardAmount,
  onCardAmountChange,
  remainingSplit,
}: SaleFormPaymentFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="amount"
            className="mb-1.5 block text-xs font-medium text-text-secondary"
          >
            Сума до оплати (грн){" "}
            {discount > 0 && (
              <span className="text-cyan font-semibold">(-{discount}%)</span>
            )}
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0"
            required
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
          />
        </div>
        {!isSplit && (
          <div>
            <label
              htmlFor="method"
              className="mb-1.5 block text-xs font-medium text-text-secondary"
            >
              Спосіб оплати
            </label>
            <select
              id="method"
              name="method"
              required
              className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet cursor-pointer"
            >
              <option value="cash">Готівка</option>
              <option value="card">Картка (термінал)</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 py-1">
        <input
          id="is_split_toggle"
          type="checkbox"
          checked={isSplit}
          onChange={(e) => {
            setIsSplit(e.target.checked);
            onCashAmountChange(amount);
            onCardAmountChange("0");
          }}
          className="h-4.5 w-4.5 rounded border-iris/20 text-violet focus:ring-violet cursor-pointer"
        />
        <label
          htmlFor="is_split_toggle"
          className="text-sm font-medium text-text-primary cursor-pointer"
        >
          Розділити оплату (Готівка + Карта)
        </label>
      </div>

      {isSplit && (
        <div className="space-y-3 p-4 rounded-xl bg-violet/5 border border-violet/10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cash_amount"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Готівка (грн)
              </label>
              <input
                id="cash_amount"
                type="number"
                min="0"
                max={amount || undefined}
                value={cashAmount}
                onChange={(e) => onCashAmountChange(e.target.value)}
                className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
              />
            </div>
            <div>
              <label
                htmlFor="card_amount"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Картка (грн)
              </label>
              <input
                id="card_amount"
                type="number"
                min="0"
                max={amount || undefined}
                value={cardAmount}
                onChange={(e) => onCardAmountChange(e.target.value)}
                className="w-full rounded-xl border border-iris/20 bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-xs mt-1.5 px-1">
            <span>Статус спліт-оплати:</span>
            {remainingSplit === 0 ? (
              <span className="text-emerald font-semibold flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Розраховано повністю</span>
              </span>
            ) : (
              <span id="split-payment-error" className="text-rose font-medium">
                {remainingSplit > 0
                  ? `Залишилось розподілити: ${remainingSplit} грн`
                  : `Перевищення ліміту на: ${Math.abs(remainingSplit)} грн`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
