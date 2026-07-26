import { BentoCell, BentoLink, CardStat } from "@/components/ui/BentoCell";
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
    >
      <CardStat value={total} unit="в роботі">
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
      </CardStat>

      {total === 0 ? (
        <p className="text-xs leading-relaxed text-muted">
          Відкритих замовлень немає. Те, що замовляєш під клієнта, стоятиме тут із дедлайном, доки
          не видаси.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-ink">
                  <span className="tabular text-muted">{o.no}</span> {o.customer}
                </span>
                {o.deadline && (
                  <span
                    className={cn(
                      "block truncate text-[11px] capitalize",
                      o.overdue ? "font-medium text-danger" : "text-muted",
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
            <li className="pt-2 text-[11px] text-faint">і ще {total - rows.length}</li>
          )}
        </ul>
      )}
    </BentoCell>
  );
}
