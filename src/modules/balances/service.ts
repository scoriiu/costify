import { prisma } from "@/lib/db";
import { getContBase } from "@/lib/accounts";
import { computeBalanceFromJournal } from "./compute-balance";
import { getCatalogMap, getClientAccounts, getPartnerNames, resolveFromMaps } from "@/modules/accounts";
import { isExtraBilantierCode } from "@/modules/accounts/flags";
import type { Result } from "@/shared/errors";
import { ok, err, notFound } from "@/shared/errors";
import type { BalanceRowView, BalanceSummary, DatasetPeriod } from "./types";
import type { JournalEntry } from "@/modules/ingestion/types";

/** See JSDoc on `getSlimEntries` below for the full motivation. */
export interface SlimEntry {
  year: number;
  month: number;
  contD: string;
  contDBase: string;
  contC: string;
  contCBase: string;
  suma: number;
}

export async function getBalanceRows(
  clientId: string,
  year: number,
  month: number,
): Promise<Result<BalanceRowView[]>> {
  const t0 = Date.now();
  const entries = await getSlimEntries(clientId);
  const tEntries = Date.now() - t0;
  if (entries.length === 0) {
    return err(notFound("Journal entries", clientId));
  }

  const t1 = Date.now();
  const { accountNames, unmappedBases } = await buildAccountMetadata(clientId, entries);
  const tMeta = Date.now() - t1;
  const t2 = Date.now();
  const rows = computeBalanceFromJournal(entries, year, month, accountNames, unmappedBases);
  const tCompute = Date.now() - t2;
  console.log(
    `[getBalanceRows] client=${clientId.slice(0, 8)} entries=${entries.length} rows=${rows.length} | fetchEntries=${tEntries}ms meta=${tMeta}ms compute=${tCompute}ms`,
  );

  return ok(rows.map(toBalanceRowView));
}

/**
 * Hot-path variant for callers that need balances for MULTIPLE periods of the
 * same client (e.g. the 12-month trends inside loadOwnerSnapshot). Avoids
 * re-fetching the journal + account metadata per period — they're identical
 * across periods, only the `(year, month)` window changes.
 *
 * Returns ONE prepared context. Use `computeBalanceFromContext(ctx, year, month)`
 * to derive each period's rows in pure JS (~50-80 ms each) without further DB
 * trips. For a 13-period owner snapshot this drops total DB work from 13×
 * `getActiveEntries` (3+ s) to a single load (~250 ms).
 */
export interface BalanceContext {
  entries: SlimEntry[];
  accountNames: Map<string, string>;
  unmappedBases: Set<string>;
}

export async function prepareBalanceContext(
  clientId: string,
): Promise<BalanceContext | null> {
  const entries = await getSlimEntries(clientId);
  if (entries.length === 0) return null;

  const { accountNames, unmappedBases } = await buildAccountMetadata(clientId, entries);
  return { entries, accountNames, unmappedBases };
}

export function computeBalanceFromContext(
  ctx: BalanceContext,
  year: number,
  month: number,
): BalanceRowView[] {
  const rows = computeBalanceFromJournal(
    ctx.entries,
    year,
    month,
    ctx.accountNames,
    ctx.unmappedBases,
  );
  return rows.map(toBalanceRowView);
}

export async function getBalanceSummary(
  clientId: string,
  year: number,
  month: number,
): Promise<Result<BalanceSummary>> {
  const result = await getBalanceRows(clientId, year, month);
  if (!result.ok) return result;

  // D11: totals exclude extra-bilantier rows (class 8/9 memorandum accounts).
  // They show in the table for visibility but do NOT affect the "is balanced" check.
  const leafRows = result.data.filter((r) => r.isLeaf && !r.isExtraBilantier);
  let totalFinD = 0;
  let totalFinC = 0;
  let totalRulajD = 0;
  let totalRulajC = 0;

  for (const row of leafRows) {
    totalFinD += row.finD;
    totalFinC += row.finC;
    totalRulajD += row.rulajD;
    totalRulajC += row.rulajC;
  }

  return ok({
    totalFinD: round2(totalFinD),
    totalFinC: round2(totalFinC),
    totalRulajD: round2(totalRulajD),
    totalRulajC: round2(totalRulajC),
    accountCount: leafRows.length,
    isBalanced: Math.abs(totalFinD - totalFinC) < 0.01,
  });
}

/**
 * Distinct (year, month) periods that have journal data for a client.
 *
 * Hot path: this runs on EVERY page load of /clients/<slug> to seed the
 * period selector and pick a default month. On a 580k-row client it
 * previously took ~660 ms (125 ms in Postgres + 500 ms in Prisma's ORM
 * hydration of the result set). The page wouldn't render any pixels
 * until this resolved.
 *
 * Two optimizations together drop it to ~8 ms server-side:
 *
 * 1. **Loose index scan** — `prisma.findMany({ distinct })` makes
 *    Postgres do a parallel seq scan + HashAggregate because the
 *    planner doesn't translate `DISTINCT (year, month)` into a btree
 *    walk. A hand-rolled recursive CTE jumps through the
 *    `(clientId, year, month)` index one distinct prefix at a time —
 *    O(distinct_count × log N) instead of O(N).
 *
 * 2. **`$queryRaw` over `findMany`** — bypasses Prisma's per-row ORM
 *    hydration. The result is plain JS `{year, month}` objects, ready
 *    to ship.
 *
 * Verified on prod fixture (UpperHouse, 581k rows, 137 distinct
 * periods): 125 ms → 8 ms in Postgres, ~660 ms → ~10 ms total via
 * Prisma client.
 */
export async function getAvailablePeriods(clientId: string): Promise<DatasetPeriod[]> {
  const rows = await prisma.$queryRaw<Array<{ year: number; month: number }>>`
    WITH RECURSIVE t AS (
      (
        SELECT year, month
        FROM "JournalLine"
        WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
        ORDER BY year, month
        LIMIT 1
      )
      UNION ALL
      SELECT
        (
          SELECT "JournalLine".year FROM "JournalLine"
          WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
            AND (year, month) > (t.year, t.month)
          ORDER BY year, month LIMIT 1
        ) AS year,
        (
          SELECT "JournalLine".month FROM "JournalLine"
          WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
            AND (year, month) > (t.year, t.month)
          ORDER BY year, month LIMIT 1
        ) AS month
      FROM t
      WHERE t.year IS NOT NULL
    )
    SELECT year, month FROM t
    WHERE year IS NOT NULL
    ORDER BY year, month
  `;
  return rows.map((r) => ({ year: r.year, month: r.month }));
}

/**
 * Distinct years that have journal data for a client. Same loose
 * index-scan trick as getAvailablePeriods — see comment there. The
 * result set is tiny (≤ 20 entries even for old clients) so the
 * overall cost is dominated by index traversal, not row hydration.
 */
export async function getAvailableYears(clientId: string): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ year: number }>>`
    WITH RECURSIVE t AS (
      (
        SELECT year FROM "JournalLine"
        WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
        ORDER BY year LIMIT 1
      )
      UNION ALL
      SELECT (
        SELECT "JournalLine".year FROM "JournalLine"
        WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
          AND year > t.year
        ORDER BY year LIMIT 1
      ) AS year
      FROM t
      WHERE t.year IS NOT NULL
    )
    SELECT year FROM t WHERE year IS NOT NULL ORDER BY year
  `;
  return rows.map((r) => r.year);
}

/**
 * Hot path: returns every active journal entry for a client (10k-100k+ rows).
 *
 * Uses $queryRaw instead of prisma.journalLine.findMany to bypass Prisma's
 * per-row ORM hydration. On a 16,802-row client, findMany took 750-2000 ms
 * in production (most of that was wrapping each `suma` Decimal column in a
 * Prisma Decimal class instance and constructing model objects); $queryRaw
 * returns plain JS objects and is typically 5-10× faster.
 *
 * The cast to number for `suma`/`tva` happens here once, so callers get the
 * same JournalEntry shape they had before.
 */
export async function getActiveEntries(clientId: string): Promise<JournalEntry[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      data: Date;
      year: number;
      month: number;
      ndp: string;
      contD: string;
      contDBase: string;
      contC: string;
      contCBase: string;
      suma: string; // pg numeric → string in node-postgres
      explicatie: string;
      felD: string;
      categorie: string | null;
      cod: string | null;
      validat: string | null;
      tva: string | null;
    }>
  >`
    SELECT data, year, month, ndp, "contD", "contDBase", "contC", "contCBase",
           suma::text AS suma, explicatie, "felD", categorie, cod, validat,
           tva::text AS tva
    FROM "JournalLine"
    WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
    ORDER BY data ASC, ndp ASC
  `;

  return rows.map((r) => ({
    data: r.data,
    year: r.year,
    month: r.month,
    ndp: r.ndp,
    contD: r.contD,
    contDBase: r.contDBase,
    contC: r.contC,
    contCBase: r.contCBase,
    suma: Number(r.suma),
    explicatie: r.explicatie,
    felD: r.felD,
    categorie: r.categorie,
    cod: r.cod,
    validat: r.validat,
    tva: r.tva === null ? null : Number(r.tva),
  }));
}

/**
 * Slim variant of `getActiveEntries` for the reporting hot path —
 * SQL-side aggregated by (year, month, contD, contC).
 *
 * Why aggregate in SQL: `computeBalanceFromJournal`,
 * `buildAccountMetadata` and `detectRegimeForPeriod` iterate every row
 * only to bump per-account sums (`rulajD`, `rulajtD`, etc). Whether the
 * loop sees three rows of `suma=100` or one row of `suma=300` makes no
 * difference to the final number — addition is associative and the
 * filter conditions (`year`, `month`, `contD === "%"`) are functions of
 * the group keys, so they apply identically to the group as to each row.
 *
 * `contDBase` / `contCBase` are GROUP BY columns even though they're
 * derivable from `contD`/`contC` — Postgres needs them in the grouping
 * to project them in SELECT, and they're cheap on the index.
 *
 * Why this matters: on Upperhouse's 193,684 raw rows there are only
 * 89,761 distinct (year, month, contD, contC) groups — a 2.2x shrink.
 * Plus the SUM happens in Postgres's tight C loop instead of V8.
 *
 * Earlier wins still apply: only the 7 columns the compute actually
 * reads (full row is 15), and no ORDER BY (the compute aggregates into
 * maps keyed by account, row order is irrelevant).
 *
 * Measured journey on Upperhouse's 193,684-row journal:
 *   Full fetch (15 cols, 194k rows):                 ~5.5 s
 *   Slim fetch (7 cols, 194k rows):                  ~2.2 s
 *   Slim + SQL-aggregated (7 cols, 90k groups):    target ~0.8 s
 */
export async function getSlimEntries(clientId: string): Promise<SlimEntry[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      year: number;
      month: number;
      contD: string;
      contDBase: string;
      contC: string;
      contCBase: string;
      suma: string;
    }>
  >`
    SELECT year, month, "contD", "contDBase", "contC", "contCBase",
           SUM(suma)::text AS suma
    FROM "JournalLine"
    WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
    GROUP BY year, month, "contD", "contDBase", "contC", "contCBase"
  `;

  return rows.map((r) => ({
    year: r.year,
    month: r.month,
    contD: r.contD,
    contDBase: r.contDBase,
    contC: r.contC,
    contCBase: r.contCBase,
    suma: Number(r.suma),
  }));
}

async function buildAccountMetadata(
  clientId: string,
  entries: Array<{ contD: string; contC: string }>
): Promise<{ accountNames: Map<string, string>; unmappedBases: Set<string> }> {
  const [clientAccounts, catalog, partnerNames] = await Promise.all([
    getClientAccounts(clientId),
    getCatalogMap(),
    getPartnerNames(clientId),
  ]);

  const names = new Map<string, string>();
  const unmappedBases = new Set<string>();

  const checkUnmapped = (cont: string) => {
    const base = getContBase(cont);
    if (!catalog.has(base)) unmappedBases.add(base);
  };

  for (const e of entries) {
    if (!names.has(e.contD)) {
      names.set(e.contD, resolveFromMaps(e.contD, clientAccounts, catalog, partnerNames).name);
      checkUnmapped(e.contD);
    }
    if (!names.has(e.contC)) {
      names.set(e.contC, resolveFromMaps(e.contC, clientAccounts, catalog, partnerNames).name);
      checkUnmapped(e.contC);
    }
  }

  return { accountNames: names, unmappedBases };
}

function toBalanceRowView(row: {
  cont: string;
  contBase: string;
  denumire: string;
  tip: string;
  unmapped: boolean;
  isLeaf: boolean;
  hasChild: boolean;
  debInit: number;
  credInit: number;
  soldInD: number;
  soldInC: number;
  debPrec: number;
  credPrec: number;
  rulajD: number;
  rulajC: number;
  rulajTD: number;
  rulajTC: number;
  totalDeb: number;
  totalCred: number;
  finD: number;
  finC: number;
}): BalanceRowView {
  return { ...row, isExtraBilantier: isExtraBilantierCode(row.contBase) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
