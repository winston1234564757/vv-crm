"use client";

interface SaleFormExtraDetailsProps {
  promoCode: string;
  setPromoCode: (val: string) => void;
  promoMessage: { text: string; type: "success" | "error" } | null;
  handleCheckPromo: () => void;
  warrantyStart: string;
  setWarrantyStart: (val: string) => void;
  warrantyEnd: string;
  setWarrantyEnd: (val: string) => void;
}

export default function SaleFormExtraDetails({
  promoCode,
  setPromoCode,
  promoMessage,
  handleCheckPromo,
  warrantyStart,
  setWarrantyStart,
  warrantyEnd,
  setWarrantyEnd,
}: SaleFormExtraDetailsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="sale_type" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Тип продажу
          </label>
          <select
            id="sale_type"
            name="sale_type"
            required
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet focus:ring-1 focus:ring-violet cursor-pointer"
          >
            <option value="retail">Роздріб</option>
            <option value="online">Онлайн</option>
          </select>
        </div>
        <div>
          <label htmlFor="monobank_payment_id" className="mb-1.5 block text-xs font-medium text-text-secondary">
            ID транзакції Monobank
          </label>
          <input
            id="monobank_payment_id"
            name="monobank_payment_id"
            type="text"
            placeholder="якщо оплата карткою"
            className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none transition-colors focus:border-violet"
          />
        </div>
      </div>

      <div className="rounded-xl border border-violet/20 bg-violet/5 p-4 space-y-2">
        <label className="block text-xs font-medium text-violet">Промокод партнера (опціонально)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="VVC-XXXX"
            className="flex-1 rounded-lg border border-iris/20 bg-white px-3 py-2 text-sm uppercase font-mono outline-none focus:border-violet"
          />
          <button
            type="button"
            onClick={handleCheckPromo}
            className="rounded-lg bg-violet px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-hover cursor-pointer"
          >
            Застосувати
          </button>
        </div>
        {promoMessage && (
          <p className={`text-xs font-medium ${promoMessage.type === "success" ? "text-emerald" : "text-rose"}`}>
            {promoMessage.text}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-iris/20 bg-iris/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-text-primary">Гарантія на товар</label>
          <span className="text-[10px] text-text-secondary bg-white px-2 py-0.5 rounded border border-iris/10 font-medium">Автоматичний розрахунок</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="warranty_start" className="mb-1 block text-[10px] font-medium text-text-secondary">
              Початок гарантії
            </label>
            <input
              id="warranty_start"
              name="warranty_start"
              type="date"
              value={warrantyStart}
              onChange={(e) => {
                setWarrantyStart(e.target.value);
              }}
              className="w-full rounded-lg border border-iris/20 bg-white px-3 py-2 text-xs text-text-primary outline-none focus:border-violet cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="warranty_end" className="mb-1 block text-[10px] font-medium text-text-secondary">
              Кінець гарантії
            </label>
            <input
              id="warranty_end"
              name="warranty_end"
              type="date"
              value={warrantyEnd}
              onChange={(e) => setWarrantyEnd(e.target.value)}
              className="w-full rounded-lg border border-iris/20 bg-white px-3 py-2 text-xs text-text-primary outline-none focus:border-violet cursor-pointer"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-text-secondary">Швидкі пресети:</span>
          {[
            { label: "Без гарантії", months: 0 },
            { label: "1 міс", months: 1 },
            { label: "3 міс", months: 3 },
            { label: "6 міс", months: 6 },
            { label: "12 міс", months: 12 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                if (preset.months === 0) {
                  setWarrantyEnd("");
                } else {
                  const startStr = warrantyStart || new Date().toISOString().split("T")[0];
                  const start = new Date(startStr);
                  if (!isNaN(start.getTime())) {
                    start.setMonth(start.getMonth() + preset.months);
                    setWarrantyEnd(start.toISOString().split("T")[0]);
                  }
                }
              }}
              className="px-2 py-1 rounded bg-white hover:bg-iris/10 border border-iris/10 text-[10px] font-medium text-text-primary transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-text-secondary">
          Коментар
        </label>
        <textarea
          id="notes"
          name="notes"
          placeholder="Нотатки до продажу..."
          className="w-full rounded-xl border border-iris/20 bg-transparent px-4 py-3 text-sm text-text-primary outline-none focus:border-violet"
          rows={2}
        />
      </div>
    </>
  );
}
