import { BentoCell, BentoLink } from "@/components/ui/BentoCell";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { orderStatus as orderStatusLabels } from "@/lib/domain-labels";
import { dayLabel } from "@/lib/utils/day";
import type { OrderRow } from "@/lib/data-operations";

/**
 * Клієнтські замовлення, які ще чекають дії. Прострочені виносяться нагору
 * окремим числом: замовлення, за яким клієнт прийшов у обіцяний день і не
 * отримав його, коштує дорожче за будь-яку іншу помилку на цьому екрані.
 */
export function OrdersCard({
  rows,
  total,
  arrived,
  ready,
  overdue,
}: {
  rows: OrderRow[];
  total: number;
  arrived: number;
  ready: number;
  overdue: number;
}) {
  return (
    <BentoCell
      span={4}
      title="Замовлення"
      action={<BentoLink href="/admin/orders">усі замовлення</BentoLink>}
      className="justify-between"
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-3xl font-semibold tabular tracking-tight text-ink">
          {total}
        </span>
        <span className="text-xs text-muted">в роботі</span>
        {arrived > 0 && (
          <span className="text-xs text-muted">
            приїхало <span className="font-semibold tabular text-accent-ink">{arrived}</span>
          </span>
        )}
        {ready > 0 && (
          <span className="text-xs text-muted">
            готово <span className="font-semibold tabular text-success">{ready}</span>
          </span>
        )}
        {overdue > 0 && (
          <span className="text-xs text-muted">
            прострочено <span className="font-semibold tabular text-danger">{overdue}</span>
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted">
          Відкритих замовлень немає. Замовлене під клієнта з&apos;явиться тут.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="block truncate text-ink">
                  <span className="tabular text-muted">{o.no}</span> {o.customer}
                </span>
                {o.deadline && (
                  <span
                    className={cn(
                      "block truncate text-[11px] capitalize",
                      o.overdue ? "text-danger" : "text-muted",
                    )}
                  >
                    {o.overdue ? "мав бути " : "до "}
                    {dayLabel(o.deadline)}
                  </span>
                )}
              </span>
              <Badge tone={orderStatusLabels[o.status]?.tone ?? "neutral"}>
                {orderStatusLabels[o.status]?.label ?? o.status}
              </Badge>
            </li>
          ))}
          {total > rows.length && (
            <li className="text-[11px] text-faint">і ще {total - rows.length}</li>
          )}
        </ul>
      )}
    </BentoCell>
  );
}
