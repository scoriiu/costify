/**
 * Materialized Plan de Conturi cache — mirror of `computed-period.ts` for
 * `/api/client-accounts`.
 *
 * The Plan response is the heaviest read in the app (3.5 MB / 11k rows for
 * Upperhouse). Live compute takes ~3-4 s: two heavy GROUP BY queries on
 * the journal, plus a balance compute, plus a 5-way merge. Materializing
 * the response collapses the entire pipeline into one keyed SELECT.
 *
 * Same correctness invariants as ComputedPeriod:
 *
 * - A row is valid IFF its `dataVersion` matches the current
 *   `Client.dataVersion`. Reads filter by version in the WHERE clause —
 *   we never return a row and check the version in JS.
 * - Stale rows are NEVER deleted on mutation. Mutations bump
 *   `dataVersion`, which makes prior rows unreachable. The next read
 *   triggers a fresh recompute that overwrites via upsert.
 * - The unique key is `(clientId, year, month)`. `year` and `month` are
 *   both nullable: a row with `(year=null, month=null)` stores the
 *   period-independent base plan; rows with `(year=Y, month=M)` store
 *   the fully-populated plan for that period.
 * - Write re-reads `dataVersion` at write time (not from the caller)
 *   to defend the race where a mutation bumps version mid-compute.
 */

import { prisma } from "@/lib/db";
import { getClientDataVersion } from "@/modules/clients/data-version";
import type { PlanRow } from "./plan";

export type ComputedBy = "lazy" | "eager";

export interface ComputedPlanPayload {
  rows: PlanRow[];
}

/**
 * Sentinel year/month values for the period-independent base plan.
 * Prisma's compound @@unique doesn't allow nullable columns, so we use
 * `(0, 0)` as the "no period" key. Real journal data never has year=0.
 */
const NO_PERIOD_YEAR = 0;
const NO_PERIOD_MONTH = 0;

function periodKey(period: { year: number; month: number } | undefined): {
  year: number;
  month: number;
} {
  return period ?? { year: NO_PERIOD_YEAR, month: NO_PERIOD_MONTH };
}

/**
 * Return a materialized plan for (clientId, year?, month?) if and only if
 * its `dataVersion` matches the current client data version. Returns null
 * otherwise — caller falls back to live compute.
 */
export async function readComputedPlan(
  clientId: string,
  period: { year: number; month: number } | undefined,
): Promise<ComputedPlanPayload | null> {
  const { year, month } = periodKey(period);
  const currentVersion = await getClientDataVersion(clientId);
  const row = await prisma.computedPlan.findFirst({
    where: { clientId, year, month, dataVersion: currentVersion },
    select: { rows: true },
  });
  if (!row) return null;
  return { rows: row.rows as unknown as PlanRow[] };
}

export async function writeComputedPlan(
  clientId: string,
  period: { year: number; month: number } | undefined,
  payload: ComputedPlanPayload,
  computedBy: ComputedBy = "lazy",
): Promise<void> {
  const { year, month } = periodKey(period);
  const currentVersion = await getClientDataVersion(clientId);
  await prisma.computedPlan.upsert({
    where: { clientId_year_month: { clientId, year, month } },
    create: {
      clientId,
      year,
      month,
      dataVersion: currentVersion,
      rows: payload.rows as never,
      computedBy,
    },
    update: {
      dataVersion: currentVersion,
      rows: payload.rows as never,
      computedAt: new Date(),
      computedBy,
    },
  });
}

export async function precomputePlans(
  clientId: string,
  periods: Array<{ year: number; month: number } | undefined>,
  compute: (
    period: { year: number; month: number } | undefined,
  ) => Promise<ComputedPlanPayload | null>,
): Promise<number> {
  let written = 0;
  for (const period of periods) {
    try {
      const payload = await compute(period);
      if (payload === null) continue;
      await writeComputedPlan(clientId, period, payload, "eager");
      written++;
    } catch (e) {
      const label = period ? `${period.year}-${period.month}` : "base";
      console.warn(
        `[precomputePlans] skipped client=${clientId} period=${label}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return written;
}
