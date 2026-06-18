import { prisma } from "@/lib/db";

/** One stored monthly headcount, as plain numbers for the UI. */
export interface EmployeeCountPoint {
  year: number;
  month: number;
  count: number;
}

/** All stored headcounts for a client, ascending by period. */
export async function getEmployeeCounts(clientId: string): Promise<EmployeeCountPoint[]> {
  const rows = await prisma.employeeCount.findMany({
    where: { clientId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    select: { year: true, month: true, count: true },
  });
  return rows.map((r) => ({ year: r.year, month: r.month, count: Number(r.count) }));
}

/** The headcount for a single period, or null if not set. */
export async function getEmployeeCount(
  clientId: string,
  year: number,
  month: number
): Promise<number | null> {
  const row = await prisma.employeeCount.findUnique({
    where: { clientId_year_month: { clientId, year, month } },
    select: { count: true },
  });
  return row ? Number(row.count) : null;
}
