// Pure helpers for the Income and KPI numbers (D-035). Days are UTC calendar days, oldest first.

export type DayRow = { day: string; revenueCents: number; orders: number; customers: number };
export type Series = { days: string[]; revenueCents: number[]; orders: number[]; customers: number[] };

/** `YYYY-MM-DD` of a date in UTC. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last `count` UTC days ending today (inclusive), oldest first. */
export function lastDays(count: number, now: Date): string[] {
  const days: string[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let offset = count - 1; offset >= 0; offset--) days.push(utcDay(new Date(end - offset * 86_400_000)));
  return days;
}

/** Fills a per-day series from sparse database rows; days without sales are real zeros. */
export function buildSeries(rows: DayRow[], count: number, now: Date): Series {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days = lastDays(count, now);
  return {
    days,
    revenueCents: days.map((day) => byDay.get(day)?.revenueCents ?? 0),
    orders: days.map((day) => byDay.get(day)?.orders ?? 0),
    customers: days.map((day) => byDay.get(day)?.customers ?? 0),
  };
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Sum of the last `days` entries (the series ends today). */
export function lastSum(values: number[], days: number): number {
  return sum(values.slice(-days));
}
