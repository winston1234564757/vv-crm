/**
 * Скелет під бенто-сітку дашборду. Форма повторює реальний макет — hero на
 * дві третини, вузька колонка черги, три операційні картки, — щоб при появі
 * даних нічого не стрибало.
 *
 * Токени сучасні (`bg-hover`, `bg-border`): попередня версія висіла на
 * легасі-аліасах `bg-iris/10` і `bg-warm-border/30`.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-[var(--radius-md)] bg-border" />
        <div className="h-4 w-64 rounded-[var(--radius-sm)] bg-hover" />
      </div>

      <div className="h-9 w-80 max-w-full rounded-[var(--radius-md)] bg-hover" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        <div className="h-44 rounded-[var(--radius-lg)] bg-border md:col-span-6 lg:col-span-8" />
        <div className="h-44 rounded-[var(--radius-lg)] bg-hover md:col-span-3 lg:col-span-4" />

        <div className="h-40 rounded-[var(--radius-lg)] bg-hover md:col-span-3 lg:col-span-4" />
        <div className="h-40 rounded-[var(--radius-lg)] bg-hover md:col-span-3 lg:col-span-4" />
        <div className="h-40 rounded-[var(--radius-lg)] bg-hover md:col-span-3 lg:col-span-4" />

        <div className="h-72 rounded-[var(--radius-lg)] bg-hover md:col-span-6 lg:col-span-8" />
        <div className="h-72 rounded-[var(--radius-lg)] bg-hover md:col-span-6 lg:col-span-4" />
      </div>
    </div>
  );
}
