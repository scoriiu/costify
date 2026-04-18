/**
 * Prisma shell for loading plan-de-conturi inputs. Calls into the pure
 * buildPlan() with fully-prepared inputs.
 *
 * Kept separate from plan.ts so that builder logic is unit-testable without
 * a database.
 */

import { prisma } from "@/lib/db";
import { getBalanceRows } from "@/modules/balances";
import { getCatalogMap, getClientAccounts } from "./service";
import { buildPlan } from "./plan";
import type { PlanRow, PlanUsageStats } from "./plan";

export interface GetPlanOptions {
  /** When provided, current sold (finD/finC) is populated for each account. */
  period?: { year: number; month: number };
}

export async function getClientPlan(
  clientId: string,
  options: GetPlanOptions = {}
): Promise<PlanRow[]> {
  const [catalog, clientAccounts, usage, balanceRows] = await Promise.all([
    getCatalogMap(),
    getClientAccounts(clientId),
    loadUsageStats(clientId),
    loadBalanceForPeriod(clientId, options.period),
  ]);

  return buildPlan({ catalog, clientAccounts, usage, balanceRows });
}

/**
 * Aggregate journal usage per analytic account.
 * Uses raw SQL for performance: two COUNT+MIN+MAX queries against the big
 * JournalLine table, combined in memory.
 */
async function loadUsageStats(clientId: string): Promise<Map<string, PlanUsageStats>> {
  const debitRows = await prisma.$queryRaw<
    Array<{ cont: string; count: bigint; first_seen: Date; last_seen: Date }>
  >`
    SELECT "contD" AS cont, COUNT(*) AS count,
           MIN("data") AS first_seen, MAX("data") AS last_seen
    FROM "JournalLine"
    WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
    GROUP BY "contD"
  `;
  const creditRows = await prisma.$queryRaw<
    Array<{ cont: string; count: bigint; first_seen: Date; last_seen: Date }>
  >`
    SELECT "contC" AS cont, COUNT(*) AS count,
           MIN("data") AS first_seen, MAX("data") AS last_seen
    FROM "JournalLine"
    WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
    GROUP BY "contC"
  `;

  const map = new Map<string, PlanUsageStats>();
  for (const row of [...debitRows, ...creditRows]) {
    const existing = map.get(row.cont);
    const count = Number(row.count);
    if (!existing) {
      map.set(row.cont, {
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        entriesCount: count,
      });
      continue;
    }
    existing.entriesCount += count;
    if (row.first_seen < existing.firstSeen) existing.firstSeen = row.first_seen;
    if (row.last_seen > existing.lastSeen) existing.lastSeen = row.last_seen;
  }
  return map;
}

async function loadBalanceForPeriod(
  clientId: string,
  period?: { year: number; month: number }
): Promise<Array<{ cont: string; finD: number; finC: number }> | undefined> {
  if (!period) return undefined;
  const result = await getBalanceRows(clientId, period.year, period.month);
  if (!result.ok) return undefined;
  return result.data.map((r) => ({ cont: r.cont, finD: r.finD, finC: r.finC }));
}
