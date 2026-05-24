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
  computeExpenseBreakdownFromCategories,
  computeRevenueBreakdownFromCategories,
  computeTopMonthlyExpenses,
  computeRunway,
  computeSalaryAffordability,
  computeYoy,
  computeVerticalBreakdown,
} from "./compute";
import { prisma } from "@/lib/db";
import {
  listCategoryTree,
  listMappings,
  buildResolverState,
} from "@/modules/categories";
import {
  listVerticals,
  listAllocations,
  buildVerticalResolver,
} from "@/modules/verticals";
import {
  listOverridesForClient,
  computePartnerCategoryAdjustments,
  type JournalLineForAggregation,
} from "@/modules/partner-mappings";
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

  // Try the category-aware breakdown first. When the client has at least one
  // CostCategory mapping, use the firm's own labels ("Salarii echipa tech",
  // "Outsourcing tehnic") instead of the generic OMFP 2-digit labels.
  //
  // We never auto-seed during owner-snapshot loads — that side effect must
  // come from the accountant opening the Mapari Cashflow tab explicitly.
  // If the firm has no categories yet, fall through to the PR-2a hardcoded
  // breakdown so the patron view still works.
  const [categoryTreeResult, mappings, partnerOverrides] = await Promise.all([
    listCategoryTree(prisma, clientId, { autoSeed: false }),
    listMappings(prisma, clientId),
    listOverridesForClient(prisma, clientId),
  ]);
  const useCategoryBreakdown = mappings.length > 0;
  const resolverState = useCategoryBreakdown
    ? buildResolverState(categoryTreeResult.tree, mappings)
    : null;

  // Sprint 6: compute partner-override redistribution adjustments for the
  // period. Each adjustment redirects a slice of an analytic cont's rulaj
  // from the cont's default category to the partner's chosen category.
  // Only fetches journal lines + partner names if we actually have any
  // overrides to apply — keeps the no-overrides path identical to before.
  const partnerAdjustments = await loadPartnerAdjustmentsForPeriod(
    clientId,
    year,
    month,
    partnerOverrides
  );

  const expenseBreakdown = resolverState
    ? computeExpenseBreakdownFromCategories(
        rows,
        catalog,
        resolverState,
        partnerAdjustments
      )
    : computeExpenseBreakdown(rows, catalog);
  const revenueBreakdown = resolverState
    ? computeRevenueBreakdownFromCategories(
        rows,
        catalog,
        resolverState,
        partnerAdjustments
      )
    : computeRevenueBreakdown(rows, catalog);
  const topMonthlyExpenses = computeTopMonthlyExpenses(rows, catalog, 10);
  const runway = computeRunway(summary, trends, 3);
  const salaryAffordability = computeSalaryAffordability(
    rows,
    catalog,
    summary.soldRegistruCasa + summary.soldConturiBancare
  );
  const yoy = computeYoy(trends, year, month, summary);

  // Verticals (axa B, PR-2c). Empty array when the flag is off or when no
  // verticals exist — owner UI hides the card in that case.
  const clientRow = await prisma.client.findUnique({
    where: { id: clientId },
    select: { verticalsEnabled: true },
  });
  let verticalBreakdown: ReturnType<typeof computeVerticalBreakdown> = [];
  if (clientRow?.verticalsEnabled) {
    const [verticals, allocations] = await Promise.all([
      listVerticals(prisma, clientId),
      listAllocations(prisma, clientId),
    ]);
    const defaultV = verticals.find((v) => v.isDefault);
    if (defaultV) {
      const vResolver = buildVerticalResolver(allocations, defaultV.id);
      verticalBreakdown = computeVerticalBreakdown(
        rows,
        catalog,
        vResolver,
        verticals.map((v) => ({ id: v.id, name: v.name, isDefault: v.isDefault }))
      );
    }
  }

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
    verticalBreakdown,
  };
}

/**
 * Fetches journal lines + partner names for the YTD-cumulated period and
 * computes the PartnerCategoryAdjustment[] used by the category breakdown.
 *
 * Skips both the journal-line query and the partner-name query entirely
 * when there are no overrides — preserves the no-overrides hot path with
 * zero extra DB load.
 */
async function loadPartnerAdjustmentsForPeriod(
  clientId: string,
  year: number,
  month: number,
  overrides: Awaited<ReturnType<typeof listOverridesForClient>>
) {
  if (overrides.length === 0) return [];

  const [lineRows, partnerRows] = await Promise.all([
    prisma.journalLine.findMany({
      where: {
        clientId,
        year,
        month: { lte: month },
        deletedAt: null,
        OR: [
          { contDBase: { startsWith: "6" } },
          { contCBase: { startsWith: "7" } },
        ],
      },
      select: {
        contD: true,
        contDBase: true,
        contC: true,
        contCBase: true,
        suma: true,
      },
    }),
    prisma.journalPartner.findMany({
      where: { clientId },
      select: { analyticAccount: true, partnerName: true },
    }),
  ]);

  const lines: JournalLineForAggregation[] = lineRows.map((r) => ({
    contD: r.contD,
    contDBase: r.contDBase,
    contC: r.contC,
    contCBase: r.contCBase,
    suma: Number(r.suma),
  }));

  const partnerNames = new Map<string, string>();
  for (const r of partnerRows) {
    if (r.partnerName && r.partnerName.trim() !== "") {
      partnerNames.set(r.analyticAccount, r.partnerName.trim());
    }
  }

  return computePartnerCategoryAdjustments(lines, partnerNames, overrides);
}
