/**
 * Parse a Registru Jurnal search query into Prisma `where` fragments.
 *
 * Accepts free-text + Romanian date prefixes (progressive — as the user types):
 *   "15"           -> any day 15
 *   "15.05"        -> 15 May, any year
 *   "15.05.2"      -> 15 May 2010-2099
 *   "15.05.20"     -> 15 May 2020-2029
 *   "15.05.202"    -> 15 May 2020-2029
 *   "15.05.2025"   -> 15 May 2025 exact
 *   "05.2025"      -> entire May 2025
 *   "2025"         -> entire year 2025
 *   "2025-05-15"   -> ISO exact day
 *
 * Anything that does not look date-shaped (purely digits + separators) falls
 * back to substring search over cont / explicatie / ndp.
 */

import type { Prisma } from "@prisma/client";

export interface JournalSearchFilter {
  /** Fragments to combine via OR. */
  or: Prisma.JournalLineWhereInput[];
  /** Whether the query was recognised as a date pattern. */
  dateOnly: boolean;
}

const SEP = /[.\-/]/;
const DATE_SHAPED = /^[\d.\-/]+$/;
const ISO_DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const ISO_MONTH = /^(\d{4})-(\d{1,2})$/;

const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

export function parseJournalSearch(rawQuery: string): JournalSearchFilter {
  const q = rawQuery.trim();
  if (!q) return { or: [], dateOnly: false };

  const datePart = parseDatePattern(q);
  if (datePart) return { or: [datePart], dateOnly: true };

  const or: Prisma.JournalLineWhereInput[] = [
    { contD: { contains: q, mode: "insensitive" } },
    { contC: { contains: q, mode: "insensitive" } },
    { contDBase: { contains: q, mode: "insensitive" } },
    { contCBase: { contains: q, mode: "insensitive" } },
    { explicatie: { contains: q, mode: "insensitive" } },
    { ndp: { contains: q, mode: "insensitive" } },
  ];

  return { or, dateOnly: false };
}

function parseDatePattern(q: string): Prisma.JournalLineWhereInput | null {
  let m: RegExpMatchArray | null;
  if ((m = q.match(ISO_DAY))) return iso(+m[1], +m[2], +m[3]);
  if ((m = q.match(ISO_MONTH))) return month(+m[1], +m[2]);

  if (!DATE_SHAPED.test(q)) return null;

  const parts = q.split(SEP).filter((p) => p.length > 0);
  if (parts.length === 0 || parts.length > 3) return null;

  // Single component: year (4 digits, 20xx) or day (1-2 digits)
  if (parts.length === 1) {
    const v = +parts[0];
    if (parts[0].length === 4 && v >= MIN_YEAR && v <= MAX_YEAR) return { year: v };
    if (parts[0].length <= 2 && v >= 1 && v <= 31) return anyDay(v);
    return null;
  }

  // Two components: DD.MM (day+month) or MM.YYYY (month+year, possibly partial year)
  if (parts.length === 2) {
    const [a, b] = parts;
    if (b.length === 4) {
      const yr = +b, mo = +a;
      if (yr >= MIN_YEAR && yr <= MAX_YEAR && mo >= 1 && mo <= 12) return month(yr, mo);
      return null;
    }
    // Could be MM.YYYY-prefix (e.g. "05.20" = May 2020-2029)
    if (b.length >= 1 && b.length <= 3 && /^\d+$/.test(b) && +b >= 2) {
      const mo = +a;
      if (mo >= 1 && mo <= 12) return prefixYearMonth(b, mo);
    }
    const day = +a, mo = +b;
    if (day < 1 || day > 31 || mo < 1 || mo > 12) return null;
    return anyYearDayMonth(mo, day);
  }

  // Three components: DD.MM.YYYY (or DD.MM.YYYY-prefix)
  const [dStr, mStr, yStr] = parts;
  const day = +dStr, mo = +mStr;
  if (day < 1 || day > 31 || mo < 1 || mo > 12) return null;
  if (yStr.length === 4) {
    const yr = +yStr;
    if (yr < MIN_YEAR || yr > MAX_YEAR) return null;
    return exactDay(yr, mo, day);
  }
  // partial year prefix (1-3 digits): expand to a range
  if (yStr.length >= 1 && yStr.length <= 3 && /^\d+$/.test(yStr)) {
    return prefixYearDayMonth(yStr, mo, day);
  }
  return null;
}

function iso(year: number, mo: number, day: number): Prisma.JournalLineWhereInput | null {
  if (!isValid(year, mo, day)) return null;
  return exactDay(year, mo, day);
}

function month(year: number, mo: number): Prisma.JournalLineWhereInput | null {
  if (year < MIN_YEAR || year > MAX_YEAR || mo < 1 || mo > 12) return null;
  return { year, month: mo };
}

function exactDay(year: number, mo: number, day: number): Prisma.JournalLineWhereInput {
  const start = new Date(Date.UTC(year, mo - 1, day));
  const end = new Date(Date.UTC(year, mo - 1, day + 1));
  return { data: { gte: start, lt: end } };
}

function anyDay(day: number): Prisma.JournalLineWhereInput {
  // Match day-of-month across the active years. Limited to a sensible window.
  const ranges: Prisma.JournalLineWhereInput[] = [];
  for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
    for (let mo = 1; mo <= 12; mo++) {
      if (isValid(year, mo, day)) ranges.push(exactDay(year, mo, day));
    }
  }
  return { OR: ranges };
}

function anyYearDayMonth(mo: number, day: number): Prisma.JournalLineWhereInput {
  const ranges: Prisma.JournalLineWhereInput[] = [];
  for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
    if (isValid(year, mo, day)) ranges.push(exactDay(year, mo, day));
  }
  return { OR: ranges };
}

function prefixYearMonth(prefix: string, mo: number): Prisma.JournalLineWhereInput {
  const minRaw = +(prefix + "0".repeat(4 - prefix.length));
  const maxRaw = +(prefix + "9".repeat(4 - prefix.length));
  const lo = Math.max(MIN_YEAR, minRaw);
  const hi = Math.min(MAX_YEAR, maxRaw);
  const ranges: Prisma.JournalLineWhereInput[] = [];
  for (let year = lo; year <= hi; year++) {
    ranges.push({ year, month: mo });
  }
  return { OR: ranges };
}

function prefixYearDayMonth(prefix: string, mo: number, day: number): Prisma.JournalLineWhereInput {
  const minRaw = +(prefix + "0".repeat(4 - prefix.length));
  const maxRaw = +(prefix + "9".repeat(4 - prefix.length));
  const lo = Math.max(MIN_YEAR, minRaw);
  const hi = Math.min(MAX_YEAR, maxRaw);
  const ranges: Prisma.JournalLineWhereInput[] = [];
  for (let year = lo; year <= hi; year++) {
    if (isValid(year, mo, day)) ranges.push(exactDay(year, mo, day));
  }
  return { OR: ranges };
}

function isValid(year: number, mo: number, day: number): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (mo < 1 || mo > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, mo - 1, day));
  return d.getUTCMonth() === mo - 1 && d.getUTCDate() === day;
}
