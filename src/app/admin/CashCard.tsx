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
 * Свідомо БЕЗ розбивки по касах — окрім готівка/картка одразу під головною
 * цифрою. Далі не заглиблюємось: розклад по касах живе у Фінансах, куди веде
 * посилання.
 *
 * Запас OPEX стоїть поруч, бо це та сама цифра з іншого боку: скільки ця
 * готівка протримає магазин при поточному темпі витрат.
 */
export function CashCard({
  cashTotal,
  cashOnHand,
  cashless,
  runwayDays,
  dailyOpex,
  opexSafeBalance,
  opexWindowTotal,
  opexWindowDays,
}: {
  cashTotal: number;
  cashOnHand: number;
  cashless: number;
  runwayDays: number | null;
  dailyOpex: number;
  opexSafeBalance: number;
  opexWindowTotal: number;
  opexWindowDays: number;
}) {
  const low = runwayDays !== null && runwayDays < RUNWAY_WARN_DAYS;

  return (
    <BentoCell
      span={4}
      title="Гроші в наявності"
      action={<BentoLink href="/admin/finance">по касах</BentoLink>}
    >
      <p className="font-display text-[2.5rem] font-semibold leading-none tabular tracking-tight text-ink">
        {uah(cashTotal)}
      </p>
      <p className="mt-1 text-xs text-muted">
        готівкою <span className="tabular text-ink">{uah(cashOnHand)}</span>
        {" · "}
        на карті <span className="tabular text-ink">{uah(cashless)}</span>
      </p>

      {/* Запас рахується від сейфа OPEX, а НЕ від великої цифри зверху, і це
          треба сказати вголос. Читач природно відносить «вистачить на N днів»
          до числа, під яким воно стоїть; поки сейф не названий, картка
          обіцяє запас із усіх грошей магазину, включно з тими, що вже
          розподілені на розвиток і частку власників.

          Поруч — обидва числа, з яких зроблена оцінка. Показник, який не можна
          перерахувати, доводиться приймати на віру, а на віру грошові числа
          не приймають. */}
      <p className="mt-auto pt-4 text-xs text-muted">
        {runwayDays === null ? (
          <>Резерв OPEX <span className="tabular text-ink">{uah(opexSafeBalance)}</span>. Витрат за {opexWindowDays} днів не було — темп рахувати немає з чого.</>
        ) : (
          <>
            Резерву OPEX <span className="tabular text-ink">{uah(opexSafeBalance)}</span> вистачить на{" "}
            <span className={cn("font-semibold tabular", low ? "text-warning" : "text-ink")}>
              {runwayDays} {pluralUk(runwayDays, "день", "дні", "днів")}
            </span>{" "}
            при {uah(dailyOpex)}/день
          </>
        )}
      </p>

      {runwayDays !== null && (
        <p className="mt-1 text-[11px] leading-relaxed text-faint">
          Темп — це {uah(opexWindowTotal)} витрат за {opexWindowDays} днів. Разові
          закупівлі понад 50 000 ₴ і вилучення частки в нього не входять.
        </p>
      )}
    </BentoCell>
  );
}
