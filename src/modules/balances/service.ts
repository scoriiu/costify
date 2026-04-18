import { prisma } from "@/lib/db";
import { getContBase } from "@/lib/accounts";
import { computeBalanceFromJournal } from "./compute-balance";
import { getCatalogMap, getClientAccounts, resolveFromMaps } from "@/modules/accounts";
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
  const entries = await getActiveEntries(clientId);
  if (entries.length === 0) {
    return err(notFound("Journal entries", clientId));
  }

  const { accountNames, unmappedBases } = await buildAccountMetadata(clientId, entries);
  const rows = computeBalanceFromJournal(entries, year, month, accountNames, unmappedBases);

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

async function getActiveEntries(clientId: string): Promise<JournalEntry[]> {
  const lines = await prisma.journalLine.findMany({
    where: { clientId, deletedAt: null },
    orderBy: [{ data: "asc" }, { ndp: "asc" }],
  });

  return lines.map((l) => ({
    data: l.data,
    year: l.year,
    month: l.month,
    ndp: l.ndp,
    contD: l.contD,
    contDBase: l.contDBase,
    contC: l.contC,
    contCBase: l.contCBase,
    suma: Number(l.suma),
    explicatie: l.explicatie,
    felD: l.felD,
    categorie: l.categorie,
    cod: l.cod,
    validat: l.validat,
    tva: l.tva ? Number(l.tva) : null,
  }));
}

async function buildAccountMetadata(
  clientId: string,
  entries: JournalEntry[]
): Promise<{ accountNames: Map<string, string>; unmappedBases: Set<string> }> {
  const [clientAccounts, catalog] = await Promise.all([
    getClientAccounts(clientId),
    getCatalogMap(),
  ]);

  const names = new Map<string, string>();
  const unmappedBases = new Set<string>();

  const checkUnmapped = (cont: string) => {
    const base = getContBase(cont);
    if (!catalog.has(base)) unmappedBases.add(base);
  };

  for (const e of entries) {
    if (!names.has(e.contD)) {
      names.set(e.contD, resolveFromMaps(e.contD, clientAccounts, catalog).name);
      checkUnmapped(e.contD);
    }
    if (!names.has(e.contC)) {
      names.set(e.contC, resolveFromMaps(e.contC, clientAccounts, catalog).name);
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
