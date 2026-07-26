import Link from "next/link";
import { BentoCell, BentoLink } from "@/components/ui/BentoCell";
import { cn } from "@/lib/utils/cn";
import { pluralUk } from "@/lib/utils/plural";
import { repairGroup } from "@/lib/repair-flow";
import type { QueueBucket } from "@/lib/data-operations";

/**
 * Воронка ремонтів: скільки апаратів стоїть на кожному кроці ПРЯМО ЗАРАЗ.
 *
 * Таблист періодів цю картку не чіпає — «черга за минулий місяць» не має
 * змісту. Колір несе стан, а не серію: тіловий для роботи, зелений для
 * готових, жовтий для очікування деталей (це єдиний крок, де затримка не
 * залежить від майстерні). Порожні кроки лишаються в списку сірими, щоб
 * рядки не перестрибували з місця на місце між рендерами; клікати їх нема
 * куди, тому в них вимкнені події вказівника й фокус.
 *
 * Рядок веде у список ремонтів, відфільтрований по ГРУПІ, а не по статусу:
 * сегменти там саме групові (`repair-flow.ts`), і посилання на неіснуючий
 * фільтр відкривало б порожню сторінку.
 */

const TONE: Record<string, string> = {
  active: "bg-accent",
  ready: "bg-success",
  waiting: "bg-warning",
};

function barTone(status: string): string {
  if (status === "awaiting_parts") return TONE.waiting;
  return repairGroup(status) === "ready" ? TONE.ready : TONE.active;
}

export function RepairQueueCard({
  queue,
  total,
}: {
  queue: QueueBucket[];
  total: number;
}) {
  const peak = Math.max(...queue.map((b) => b.count), 1);

  return (
    <BentoCell
      span={4}
      title="Черга ремонтів"
      action={<BentoLink href="/admin/repairs">усі ремонти</BentoLink>}
      className="justify-between"
    >
      <p className="mb-4">
        <span className="font-display text-3xl font-semibold tabular tracking-tight text-ink">
          {total}
        </span>{" "}
        <span className="text-xs text-muted">
          {pluralUk(total, "апарат", "апарати", "апаратів")} у роботі
        </span>
      </p>

      {total === 0 ? (
        <p className="text-xs text-muted">
          Черга порожня — усе видано. Нові ремонти з&apos;являться тут одразу після прийому.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue.map((b) => (
            <li key={b.status}>
              <Link
                href={`/admin/repairs?seg=${repairGroup(b.status)}`}
                className={cn(
                  "-mx-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-[var(--radius-sm)] px-2 py-1 transition-colors",
                  b.count > 0 ? "hover:bg-hover" : "pointer-events-none",
                )}
                aria-disabled={b.count === 0}
                tabIndex={b.count === 0 ? -1 : undefined}
              >
                <span className={cn("text-xs", b.count > 0 ? "text-ink" : "text-faint")}>
                  {b.label}
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular",
                    b.count > 0 ? "text-ink" : "text-faint",
                  )}
                >
                  {b.count}
                </span>
                <span className="col-span-2 h-1 overflow-hidden rounded-full bg-hover">
                  {b.count > 0 && (
                    <span
                      className={cn("block h-full rounded-full", barTone(b.status))}
                      style={{ width: `${(b.count / peak) * 100}%` }}
                    />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BentoCell>
  );
}
