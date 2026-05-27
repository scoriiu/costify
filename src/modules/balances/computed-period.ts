/**
 * Materialized balance + KPI + CPP cache (the "instant" tier).
 *
 * The hot read path for `/api/balance` and the owner dashboard used to be:
 *
 *   1. Fetch 90k aggregated journal rows from Postgres (~1.1 s)
 *   2. Build account-name + unmapped metadata (~0.2 s)
 *   3. Run computeBalanceFromJournal (~0.2 s)
 *   4. Run computeKpis + computeCpp + computeCppF20 (~0.03 s)
 *   5. Resolve tax regime for this (year, month) (parallel)
 *
 * Total ~1.5 s server-side per (year, month) per client per dataVersion bump.
 *
 * This module replaces steps 1-5 with one keyed SELECT against
 * `ComputedPeriod`, returning a pre-baked snapshot of the API response.
 * Server-side compute drops to ~20 ms.
 *
 * Correctness model — read it twice before touching this:
 *
 * - A `ComputedPeriod` row is valid IFF its `dataVersion` matches the
 *   current `Client.dataVersion` at read time. Otherwise it's stale.
 * - Stale rows are NEVER deleted on mutation. Two reasons:
 *     a) Mutations don't need to know which periods are affected
 *        (avoid foot-guns, keep bumps trivial).
 *     b) Background recompute jobs and lazy read-fallback both write
 *        rows; deleting on bump would race with concurrent writes.
 * - On read miss / staleness, we live-compute and write back. This is
 *   self-healing: the very next read for the same (clientId, year, month,
 *   dataVersion) is instant.
 * - Pre-warming (eager population from the import worker) is a pure
 *   optimization — correctness does not depend on it. If pre-warm is
 *   skipped, the first user read pays the full ~1.5 s and writes the
 *   row; subsequent reads are instant.
 *
 * Why JSONB instead of relational rows: the API response shape (rows[],
 * kpis, cpp, cppF20) is already a denormalized snapshot. Storing each
 * balance row as a relational record would mean an 800-row JOIN per
 * read, defeating the whole point. JSONB lets us SELECT ... LIMIT 1
 * and return the parsed object directly.
 *
 * Storage: ~50 KB per period for an Upperhouse-sized client (846 rows).
 * 1000 clients × 24 periods × 50 KB ≈ 1.2 GB total. Cheap on Postgres,
 * and we have an option to LRU-evict by `computedAt` later if needed.
 */

import { prisma } from "@/lib/db";
import { getClientDataVersion } from "@/modules/clients/data-version";
import type { BalanceRowView } from "./types";
import type { KpiSnapshot, CppData, CppF20Data } from "@/modules/reporting";
import type { TaxRegime } from "@/modules/accounts";

export interface ComputedPeriodPayload {
  rows: BalanceRowView[];
  kpis: KpiSnapshot | null;
  cpp: CppData | null;
  cppF20: CppF20Data | null;
  taxRegime: TaxRegime;
}

/**
 * Try to read a materialized snapshot. Returns null if missing or stale.
 *
 * "Stale" means the row's dataVersion is older than the current client
 * data version. We don't bother SELECTing the row only to discard it —
 * the WHERE clause filters by dataVersion so a stale row is invisible.
 */
export async function readComputedPeriod(
  clientId: string,
  year: number,
  month: number,
): Promise<ComputedPeriodPayload | null> {
  const currentVersion = await getClientDataVersion(clientId);
  const row = await prisma.computedPeriod.findFirst({
    where: { clientId, year, month, dataVersion: currentVersion },
    select: { rows: true, kpis: true, cpp: true, cppF20: true, taxRegime: true },
  });
  if (!row) return null;
  return {
    rows: row.rows as unknown as BalanceRowView[],
    kpis: row.kpis as unknown as KpiSnapshot | null,
    cpp: row.cpp as unknown as CppData | null,
    cppF20: row.cppF20 as unknown as CppF20Data | null,
    taxRegime: row.taxRegime as TaxRegime,
  };
}

export type ComputedBy = "lazy" | "eager";

/**
 * Persist a freshly computed snapshot for (clientId, year, month).
 * Uses upsert on the `(clientId, year, month)` unique index so concurrent
 * writers don't collide — last writer wins, both wrote the same data
 * version, so there's no actual conflict.
 *
 * Important: we capture `currentVersion` AGAIN at write time (not from
 * the caller's value) to defend against the race where another mutation
 * bumped dataVersion between the caller's read and write. If we wrote
 * the stale version, the next read would still see "current" and serve
 * the now-stale snapshot.
 */
export async function writeComputedPeriod(
  clientId: string,
  year: number,
  month: number,
  payload: ComputedPeriodPayload,
  computedBy: ComputedBy = "lazy",
): Promise<void> {
  const currentVersion = await getClientDataVersion(clientId);
  await prisma.computedPeriod.upsert({
    where: { clientId_year_month: { clientId, year, month } },
    create: {
      clientId,
      year,
      month,
      dataVersion: currentVersion,
      taxRegime: payload.taxRegime,
      rows: payload.rows as never,
      kpis: payload.kpis as never,
      cpp: payload.cpp as never,
      cppF20: payload.cppF20 as never,
      computedBy,
    },
    update: {
      dataVersion: currentVersion,
      taxRegime: payload.taxRegime,
      rows: payload.rows as never,
      kpis: payload.kpis as never,
      cpp: payload.cpp as never,
      cppF20: payload.cppF20 as never,
      computedAt: new Date(),
      computedBy,
    },
  });
}

/**
 * Bulk pre-warm: compute and persist multiple periods for a client.
 * Called by the import worker after finalize. Errors on individual
 * periods are isolated — one bad period doesn't poison the rest.
 *
 * Returns the count of periods written successfully.
 */
export async function precomputePeriods(
  clientId: string,
  periods: Array<{ year: number; month: number }>,
  compute: (
    year: number,
    month: number,
  ) => Promise<ComputedPeriodPayload | null>,
): Promise<number> {
  let written = 0;
  for (const { year, month } of periods) {
    try {
      const payload = await compute(year, month);
      if (payload === null) continue;
      await writeComputedPeriod(clientId, year, month, payload, "eager");
      written++;
    } catch (e) {
      console.warn(
        `[precomputePeriods] skipped client=${clientId} y=${year} m=${month}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  return written;
}
