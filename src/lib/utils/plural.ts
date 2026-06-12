/**
 * Returns the correct Ukrainian plural form of a noun based on a numeric value.
 *
 * Example:
 * pluralUk(1, 'заявка', 'заявки', 'заявок') -> 'заявка'
 * pluralUk(2, 'заявка', 'заявки', 'заявок') -> 'заявки'
 * pluralUk(5, 'заявка', 'заявки', 'заявок') -> 'заявок'
 */
export function pluralUk(value: number, one: string, two: string, five: string): string {
  const absValue = Math.abs(value) % 100;
  const num = absValue % 10;
  if (absValue > 10 && absValue < 20) return five;
  if (num > 1 && num < 5) return two;
  if (num === 1) return one;
  return five;
}
