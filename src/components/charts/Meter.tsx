import { cn } from "@/lib/utils/cn";

/**
 * Смуга заповнення: доріжка й заливка на частину її ширини.
 *
 * Найтиражованіший елемент у застосунку — вісімнадцять місць писали ті самі
 * чотири рядки розмітки. Копії розійшлись у висоті (1 / 1.5 / 2 px), у
 * наявності анімації та в тому, чи заливка має власне заокруглення. Жодна з
 * різниць не була рішенням.
 *
 * ТОН — СЕМАНТИЧНИЙ, А НЕ ДЕКОРАТИВНИЙ. `accent` — звичайна величина,
 * `success` / `warning` / `danger` означають стан, а не «третю серію». Це
 * правило дизайн-системи, і воно ж у скілі dataviz: статусні кольори
 * зарезервовані, і якщо ними розфарбувати категорії, читач шукатиме тривогу
 * там, де її немає.
 *
 * `value` — уже відсоток (0..100), а не сира величина: рахувати частку від
 * максимуму мусить викликач, бо максимум у кожного свій (пік по черзі, сума по
 * категоріях, ціль по плану), і зашивати цей вибір у примітив означало б
 * вирішити його неправильно для більшості.
 */

export type MeterTone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

/** Висота доріжки. `xs` для щільних списків, `md` — коли смуга сама є показником. */
export type MeterSize = "xs" | "sm" | "md";

const TONE_CLASS: Record<MeterTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted",
};

const SIZE_CLASS: Record<MeterSize, string> = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
};

/** Ненульова величина не має зникати: смуга в пів пікселя читається як нуль. */
const MIN_VISIBLE_PCT = 1.5;

function clamp(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(Math.max(pct, MIN_VISIBLE_PCT), 100);
}

export function Meter({
  value,
  tone = "accent",
  size = "sm",
  title,
  className,
}: {
  /** Відсоток заповнення, 0..100. */
  value: number;
  tone?: MeterTone;
  size?: MeterSize;
  /** Підказка на наведення — сира величина, якої у відсотку не видно. */
  title?: string;
  className?: string;
}) {
  const pct = clamp(value);

  return (
    <span
      className={cn(
        "block w-full overflow-hidden rounded-full bg-hover",
        SIZE_CLASS[size],
        className,
      )}
      title={title}
    >
      {pct > 0 && (
        <span
          className={cn("block h-full rounded-full transition-all duration-500", TONE_CLASS[tone])}
          style={{ width: `${pct}%` }}
        />
      )}
    </span>
  );
}

export interface MeterSegment {
  key: string;
  /** Відсоток від ПОВНОЇ ширини смуги, не від решти. Сегменти мають сумарно дати ≤ 100. */
  value: number;
  tone: MeterTone;
  title?: string;
}

/**
 * Смуга з кількох сегментів — коли ціле ділиться на частини, а не заповнюється.
 *
 * Заокруглення тут на контейнері, а не на сегментах: заокруглений внутрішній
 * стик читався б як дві окремі смуги, тобто як два показники замість одного
 * поділеного. Єдиний випадок у застосунку — готівка проти безготівки в сейфі.
 */
export function MeterStack({
  segments,
  size = "sm",
  className,
}: {
  segments: MeterSegment[];
  size?: MeterSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex w-full overflow-hidden rounded-full bg-hover",
        SIZE_CLASS[size],
        className,
      )}
    >
      {segments.map((s) => (
        <span
          key={s.key}
          className={cn("h-full transition-all duration-500", TONE_CLASS[s.tone])}
          style={{ width: `${clamp(s.value)}%` }}
          title={s.title}
        />
      ))}
    </span>
  );
}
