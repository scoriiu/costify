/**
 * Owner snapshot loader.
 *
 * Loads the complete owner-view payload for a given (clientId, year, month).
 * Reuses the production pipeline: getBalanceRows + getCatalogMap + computeKpis
 * (for tvaDePlata + marjaOperationala) + the owner-specific compute functions.
 *
 * Used by:
 *   - The production owner view at /clients/[slug]?view=owner
 *   - The internal showcase at /internal/firma/* (which calls this with QHM21
 *     hardcoded)
 *   - The owner-summary API endpoint (PR-A)
 */

import { getBalanceRows } from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { computeKpis } from "@/modules/reporting";
import {
  computeFinancialSummary,
  computeCashPosition,
  computeOwnerWithdrawals,
  computeOutstanding,
  computeInsights,
  computeExpenseBreakdown,
  computeRevenueBreakdown,
  computeTopMonthlyExpenses,
  computeRunway,
  computeSalaryAffordability,
  computeYoy,
} from "./compute";
import type { OwnerSnapshot, MonthlyTrendPoint } from "./types";
import type { CatalogAccount } from "@/modules/accounts";

const MONTH_NAMES = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

const MONTH_NAMES_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

function periodLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function computeMonthlyTrends(
  clientId: string,
  endYear: number,
  endMonth: number,
  catalog: Map<string, CatalogAccount>,
  months = 12
): Promise<MonthlyTrendPoint[]> {
  const periods: Array<{ year: number; month: number }> = [];
  let y = endYear;
  let m = endMonth;
  for (let i = 0; i < months; i++) {
    periods.unshift({ year: y, month: m });
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  const results = await Promise.all(
    periods.map(async ({ year, month }) => {
      const r = await getBalanceRows(clientId, year, month);
      if (!r.ok) return null;
      const rows = r.data;
      const summary = computeFinancialSummary(rows, catalog);
      const cashEnd = summary.soldRegistruCasa + summary.soldConturiBancare;
      const revenue = summary.cifraAfaceriLuna;
      const expenses = summary.cheltuieliLuna;
      return {
        year,
        month,
        monthLabel: MONTH_NAMES_SHORT[month - 1],
        revenue: round2(revenue),
        expenses: round2(expenses),
        profit: round2(revenue - expenses),
        cashEnd: round2(cashEnd),
        receivables: round2(summary.clientiNeincasati),
        payables: round2(summary.furnizoriNeachitati),
      };
    })
  );

  return results.filter((p): p is MonthlyTrendPoint => p !== null);
}

export interface LoadOwnerSnapshotInput {
  clientId: string;
  clientName: string;
  clientCui: string | null;
  clientSlug: string;
  year: number;
  month: number;
}

export async function loadOwnerSnapshot(
  input: LoadOwnerSnapshotInput
): Promise<OwnerSnapshot> {
  const { clientId, clientName, clientCui, clientSlug, year, month } = input;

  const [balanceResult, catalog] = await Promise.all([
    getBalanceRows(clientId, year, month),
    getCatalogMap(),
  ]);

  if (!balanceResult.ok) {
    throw new Error(
      `Nu pot incarca date pentru ${clientName} la ${periodLabel(year, month)}.`
    );
  }

  const rows = balanceResult.data;
  const kpis = computeKpis(rows, catalog);
  const summary = computeFinancialSummary(rows, catalog);
  const cashPosition = computeCashPosition(rows);
  const ownerWithdrawals = computeOwnerWithdrawals(rows);
  const outstanding = computeOutstanding(rows);
  const insights = computeInsights(
    summary,
    cashPosition,
    kpis.tvaDePlata,
    kpis.marjaOperationala
  );
  // Trends are needed both for the chart and for the YoY + runway computations
  // below — compute once and reuse.
  const trends = await computeMonthlyTrends(clientId, year, month, catalog, 12);

  const expenseBreakdown = computeExpenseBreakdown(rows, catalog);
  const revenueBreakdown = computeRevenueBreakdown(rows, catalog);
  const topMonthlyExpenses = computeTopMonthlyExpenses(rows, catalog, 10);
  const runway = computeRunway(summary, trends, 3);
  const salaryAffordability = computeSalaryAffordability(
    rows,
    catalog,
    summary.soldRegistruCasa + summary.soldConturiBancare
  );
  const yoy = computeYoy(trends, year, month, summary);

  return {
    meta: {
      clientId,
      name: clientName,
      cui: clientCui,
      slug: clientSlug,
      year,
      month,
      periodLabel: periodLabel(year, month),
    },
    summary,
    cashPosition,
    ownerWithdrawals,
    trends,
    insights,
    outstanding,
    expenseBreakdown,
    revenueBreakdown,
    topMonthlyExpenses,
    runway,
    salaryAffordability,
    yoy,
  };
}
