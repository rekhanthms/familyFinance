/**
 * Calendar dates are plain "YYYY-MM-DD" strings (no time, no time zone).
 * All day arithmetic is done in UTC so it is immune to DST and device time zone.
 */
export type ISODate = string;
export type ISODateTime = string;

const MS_PER_DAY = 86_400_000;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(date: ISODate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = parts(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtcMs(date: ISODate): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. Positive when `to` is later. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Adds calendar months, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m, d] = parts(date);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return fromUtcMs(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
}

/** "17 Oct 2026" - same text on every device (no ICU dependence). */
export function formatIndianDate(date: ISODate): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** Parses "16-10-2027" or "16/10/2027" (as written in the register). Returns null if invalid. */
export function parseIndianDate(input: string): ISODate | null {
  const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  return isISODate(iso) ? iso : null;
}

/** "2026-11-11" -> "2026-11" */
export function monthKey(date: ISODate): string {
  return date.slice(0, 7);
}

/** "2026-11" -> "Nov 2026" */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}
