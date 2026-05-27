import { prisma } from "@/lib/db";
import { getContBase } from "@/lib/accounts";
import { computeBalanceFromJournal } from "./compute-balance";
import { getCatalogMap, getClientAccounts, getPartnerNames, resolveFromMaps } from "@/modules/accounts";
import { isExtraBilantierCode } from "@/modules/accounts/flags";
import type { Result } from "@/shared/errors";
import { ok, err, notFound } from "@/shared/errors";
import type { BalanceRowView, BalanceSummary, DatasetPeriod } from "./types";
import type { JournalEntry } from "@/modules/ingestion/types";

export async function getBalanceRows(
  clientId: string,
  year: number,
  month: number,
): Promise<Result<BalanceRowView[]>> {
  const t0 = performance.now();
  const entries = await getActiveEntries(clientId);
  const t1 = performance.now();
  if (entries.length === 0) {
    return err(notFound("Journal entries", clientId));
  }

  const { accountNames, unmappedBases } = await buildAccountMetadata(clientId, entries);
  const t2 = performance.now();
  const rows = computeBalanceFromJournal(entries, year, month, accountNames, unmappedBases);
  const t3 = performance.now();

  console.log(
    `[getBalanceRows] entries=${entries.length} getActiveEntries=${(t1 - t0).toFixed(0)}ms ` +
    `buildMeta=${(t2 - t1).toFixed(0)}ms compute=${(t3 - t2).toFixed(0)}ms rows=${rows.length}`
  );
  return ok(rows.map(toBalanceRowView));
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

export async function getAvailablePeriods(clientId: string): Promise<DatasetPeriod[]> {
  const rows = await prisma.journalLine.findMany({
    where: { clientId, deletedAt: null },
    select: { year: true, month: true },
    distinct: ["year", "month"],
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return rows.map((r) => ({ year: r.year, month: r.month }));
}

export async function getAvailableYears(clientId: string): Promise<number[]> {
  const rows = await prisma.journalLine.findMany({
    where: { clientId, deletedAt: null },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "asc" },
  });

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

async function buildAccountMetadata(
  clientId: string,
  entries: JournalEntry[]
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
