/**
 * Calendar dates as "YYYY-MM-DD" strings. The engine never passes Date objects around:
 * a round is played on a calendar day in one timezone, and the string form compares
 * correctly with plain `<` / `>` because the fields are fixed-width and most-significant first.
 */
export type IsoDate = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a well-formed string that is also a real calendar date (rejects 2026-02-30). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
}

/** The calendar date at `now` in the given IANA timezone, e.g. "Asia/Kolkata". */
export function todayInTimezone(now: Date, timeZone: string): IsoDate {
  // en-CA formats as YYYY-MM-DD natively; we only rely on the digits and separators.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isFutureDate(date: IsoDate, today: IsoDate): boolean {
  return compareIsoDates(date, today) === 1;
}

/** "2026-09-12" → "12 Sep" for user-facing messages. */
export function formatShortDate(date: IsoDate): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "2026-09-21" → "2026-09-01": the first day of that month, which is how draws are keyed. */
export function firstOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

/** "2026-12-01" → "2027-01-01". */
export function addOneMonth(monthStart: IsoDate): IsoDate {
  const [year, month] = monthStart.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Draws run in calendar order: the month after the last published one, or this month for the
 * very first draw. Months can never be skipped or duplicated (GAME.md §7 decision).
 */
export function nextDrawMonth(lastPublishedMonth: IsoDate | null, today: IsoDate): IsoDate {
  if (!lastPublishedMonth) return firstOfMonth(today);
  return addOneMonth(firstOfMonth(lastPublishedMonth));
}

/** "2026-10-01" → "October 2026". */
export function formatMonth(monthStart: IsoDate): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
