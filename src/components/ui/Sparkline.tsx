/**
 * Крихітний графік тренду — рукописний SVG, без recharts.
 *
 * Живе в інвертованому hero, а recharts довелось би перефарбовувати цілком
 * заради чотирнадцяти точок: своїх шістдесяти рядків тут дешевше, ніж
 * приборкувати чужі дефолти.
 *
 * `MIN_POINTS`: на одній-двох точках лінія тренду — це не тренд, а крапка,
 * яка виглядає як зламаний віджет. Замало точок — компонент не рендериться
 * взагалі, і hero показує саму цифру.
 */

const MIN_POINTS = 3;

/** Внутрішня система координат; реальний розмір задає CSS. */
const W = 240;
const H = 44;
const PAD = 2;

export interface SparklineProps {
  values: number[];
  /** Колір лінії. Заливка — той самий колір із градієнтом у прозоре. */
  stroke: string;
  /** Унікальний id: два градієнти з однаковим id на сторінці зіллються. */
  gradientId: string;
  label?: string;
  className?: string;
}

export function Sparkline({ values, stroke, gradientId, label, className }: SparklineProps) {
  if (values.length < MIN_POINTS) return null;

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  // Плаский ряд (усі значення рівні) дав би ділення на нуль — тоді малюємо
  // лінію посередині, що чесно: тренду справді немає.
  const span = max - min || 1;

  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (values.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(values.length - 1)},${H} L${x(0)},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={label ?? "Тренд"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
