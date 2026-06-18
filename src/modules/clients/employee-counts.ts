import { prisma } from "@/lib/db";

/** One stored monthly headcount, as plain numbers for the UI. These are the
 *  EXPLICIT values the accountant typed. Months between/after them inherit the
 *  most recent explicit value (carry-forward) — see `resolveEmployeeCount`. */
export interface EmployeeCountPoint {
  year: number;
  month: number;
  count: number;
}

/** All EXPLICIT stored headcounts for a client, ascending by period. */
export async function getEmployeeCounts(clientId: string): Promise<EmployeeCountPoint[]> {
  const rows = await prisma.employeeCount.findMany({
    where: { clientId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    select: { year: true, month: true, count: true },
  });
  return rows.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) }));
}

/** Chronological ordinal for a period, for "<=" comparisons. */
function ordinal(year: number, month: number): number {
  return year * 12 + (month - 1);
}

/**
 * Pure carry-forward: the most recent explicit value at or before (year,
 * month), or null when none exists yet. Exported for unit testing.
 */
export function resolveEmployeeCount(
  points: EmployeeCountPoint[],
  year: number,
  month: number
): number | null {
  const target = ordinal(year, month);
  let best: { ord: number; count: number } | null = null;
  for (const p of points) {
    const ord = ordinal(p.year, p.month);
    if (ord <= target && (best === null || ord > best.ord)) {
      best = { ord, count: p.count };
    }
  }
  return best ? best.count : null;
}

/**
 * Headcount effective for (year, month) WITH carry-forward. This is what the
 * KPI compute path uses, so a single "we had 8 all year" entry in January
 * powers every later month automatically.
 */
export async function getEmployeeCount(
  clientId: string,
  year: number,
  month: number
): Promise<number | null> {
  const rows = await prisma.employeeCount.findMany({
    where: { clientId },
    select: { year: true, month: true, count: true },
  });
  const points = rows.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) }));
  return resolveEmployeeCount(points, year, month);
}
