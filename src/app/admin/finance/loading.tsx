/**
 * Скелет сторінки Фінансів. Форма повторює реальну розкладку — шапка, ліва
 * колонка на дві третини й права на одну, — щоб при завантаженні нічого не
 * стрибало.
 *
 * `animate-pulse` тут доречний і не суперечить DESIGN.md §6: це стан
 * завантаження, а не декоративна мікроанімація.
 */
export default function FinanceLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="border-b border-border pb-5">
        <div className="h-8 w-40 rounded-lg bg-hover" />
        <div className="mt-2 h-4 w-72 rounded bg-hover" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-56 rounded-[var(--radius-lg)] bg-hover" />

          <div className="space-y-4">
            <div className="h-5 w-44 rounded bg-hover" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-[var(--radius-lg)] bg-hover" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-[var(--radius-lg)] bg-hover" />
              ))}
            </div>
          </div>

          <div className="h-72 rounded-[var(--radius-lg)] bg-hover" />
          <div className="h-64 rounded-[var(--radius-lg)] bg-hover" />
        </div>

        <div className="space-y-6">
          <div className="h-72 rounded-[var(--radius-lg)] bg-hover" />
          <div className="h-48 rounded-[var(--radius-lg)] bg-hover" />
        </div>
      </div>
    </div>
  );
}
