import { BentoCell, BentoLink } from "@/components/ui/BentoCell";
import { cn } from "@/lib/utils/cn";
import { uah } from "@/lib/utils/money";
import { pluralUk } from "@/lib/utils/plural";

/** Нижче цього запасу підпис стає попередженням, а не довідкою. */
const RUNWAY_WARN_DAYS = 14;

/**
 * Скільки грошей у наявності — однією цифрою.
 *
 * Раніше це був дрібний рядок у футері розкладу прибутку, поруч із трьома
 * іншими фактами, і губився серед них. Тепер окрема клітинка: це число
 * звіряють із фізичною готівкою в кишені, і воно має читатися з першого
 * погляду, а не вишукуватись.
 *
 * Свідомо БЕЗ розбивки по касах. Три числа замість одного перетворюють
 * «скільки в мене грошей» на задачку на додавання; розклад по касах живе у
 * Фінансах, куди веде посилання.
 *
 * Запас OPEX стоїть поруч, бо це та сама цифра з іншого боку: скільки ця
 * готівка протримає магазин при поточному темпі витрат.
 */
export function CashCard({
  cashTotal,
  runwayDays,
  dailyOpex,
}: {
  cashTotal: number;
  runwayDays: number;
  dailyOpex: number;
}) {
  const low = runwayDays < RUNWAY_WARN_DAYS;

  return (
    <BentoCell
      span={4}
      title="Гроші в наявності"
      action={<BentoLink href="/admin/finance">по касах</BentoLink>}
    >
      <p className="font-display text-[2.5rem] font-semibold leading-none tabular tracking-tight text-ink">
        {uah(cashTotal)}
      </p>
      <p className="mt-2 text-xs text-muted">у касах і сейфах разом</p>

      <p className="mt-auto pt-4 text-xs text-muted">
        Вистачить на{" "}
        <span className={cn("font-semibold tabular", low ? "text-warning" : "text-ink")}>
          {runwayDays} {pluralUk(runwayDays, "день", "дні", "днів")}
        </span>{" "}
        при {uah(dailyOpex)}/день
      </p>
    </BentoCell>
  );
}
