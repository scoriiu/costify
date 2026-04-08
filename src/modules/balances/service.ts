import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { Result } from "@/shared/errors";
import { ok, err, notFound } from "@/shared/errors";
import type { BalanceFilter, BalanceRowView, BalanceSummary, DatasetPeriod } from "./types";

export async function getBalanceRows(filter: BalanceFilter): Promise<Result<BalanceRowView[]>> {
  const where = buildWhereClause(filter);

  const rows = await prisma.balanceRow.findMany({
    where,
    orderBy: { cont: "asc" },
  });

  if (rows.length === 0) {
    return err(notFound("Balance data", filter.datasetId));
  }

  return ok(rows.map(toBalanceRowView));
}

export async function getBalanceSummary(filter: BalanceFilter): Promise<Result<BalanceSummary>> {
  const result = await getBalanceRows({ ...filter, leafOnly: true });
  if (!result.ok) return result;

  const rows = result.data;
  let totalFinD = 0;
  let totalFinC = 0;
  let totalRulajD = 0;
  let totalRulajC = 0;

  for (const row of rows) {
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
    accountCount: rows.length,
    isBalanced: Math.abs(totalFinD - totalFinC) < 0.01,
  });
}

export async function getDatasetPeriods(datasetId: string): Promise<DatasetPeriod[]> {
  const rows = await prisma.balanceRow.findMany({
    where: { datasetId },
    select: { year: true, month: true },
    distinct: ["year", "month"],
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return rows
    .filter((r): r is { year: number; month: number } => r.year !== null && r.month !== null)
    .map((r) => ({ year: r.year, month: r.month }));
}

export async function getDatasetYears(datasetId: string): Promise<number[]> {
  const rows = await prisma.balanceRow.findMany({
    where: { datasetId },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "asc" },
  });

  return rows.filter((r) => r.year !== null).map((r) => r.year!);
}

function buildWhereClause(filter: BalanceFilter): Prisma.BalanceRowWhereInput {
  const where: Prisma.BalanceRowWhereInput = { datasetId: filter.datasetId };

  if (filter.year !== undefined) where.year = filter.year;
  if (filter.month !== undefined) where.month = filter.month;
  if (filter.leafOnly) where.isLeaf = true;
  if (filter.contBasePrefix) where.contBase = { startsWith: filter.contBasePrefix };

  return where;
}

function toBalanceRowView(row: {
  cont: string;
  contBase: string;
  denumire: string;
  tip: string;
  isLeaf: boolean;
  hasChild: boolean;
  debInit: Prisma.Decimal;
  credInit: Prisma.Decimal;
  soldInD: Prisma.Decimal;
  soldInC: Prisma.Decimal;
  debPrec: Prisma.Decimal;
  credPrec: Prisma.Decimal;
  rulajD: Prisma.Decimal;
  rulajC: Prisma.Decimal;
  rulajTD: Prisma.Decimal;
  rulajTC: Prisma.Decimal;
  totalDeb: Prisma.Decimal;
  totalCred: Prisma.Decimal;
  finD: Prisma.Decimal;
  finC: Prisma.Decimal;
}): BalanceRowView {
  return {
    cont: row.cont,
    contBase: row.contBase,
    denumire: row.denumire,
    tip: row.tip,
    isLeaf: row.isLeaf,
    hasChild: row.hasChild,
    debInit: row.debInit.toNumber(),
    credInit: row.credInit.toNumber(),
    soldInD: row.soldInD.toNumber(),
    soldInC: row.soldInC.toNumber(),
    debPrec: row.debPrec.toNumber(),
    credPrec: row.credPrec.toNumber(),
    rulajD: row.rulajD.toNumber(),
    rulajC: row.rulajC.toNumber(),
    rulajTD: row.rulajTD.toNumber(),
    rulajTC: row.rulajTC.toNumber(),
    totalDeb: row.totalDeb.toNumber(),
    totalCred: row.totalCred.toNumber(),
    finD: row.finD.toNumber(),
    finC: row.finC.toNumber(),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
