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
  computeCashflowBreakdown,
  computePatrimoniu,
  computeVerdict,
  computeKpiStrip,
  computeHealthScore,
  computeRatios,
  computeObligations,
  computeTopCustomersByActivity,
  computeTopSuppliersByActivity,
} from "./compute";
import { prisma } from "@/lib/db";
import {
  listCategoryTree,
  listMappings,
  buildResolverState,
  resolveCategoryForCont,
  type ResolverState,
} from "@/modules/categories";
import type { BalanceRowView } from "@/modules/balances";
import {
  listVerticals,
  listAllocations,
  listCategoryAllocations,
  buildVerticalResolver,
} from "@/modules/verticals";
import {
  listOverridesForClient,
  loadPartnerCategoryAdjustments,
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
  const partnerAdjustments =
    partnerOverrides.length === 0
      ? []
      : await loadPartnerCategoryAdjustments(prisma, clientId, year, month);

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
    const [verticals, allocations, categoryAllocations] = await Promise.all([
      listVerticals(prisma, clientId),
      listAllocations(prisma, clientId),
      listCategoryAllocations(prisma, clientId),
    ]);
    const defaultV = verticals.find((v) => v.isDefault);
    if (defaultV) {
      const vResolver = buildVerticalResolver(
        allocations,
        defaultV.id,
        categoryAllocations
      );
      verticalBreakdown = computeVerticalBreakdown(
        rows,
        catalog,
        vResolver,
        verticals.map((v) => ({ id: v.id, name: v.name, isDefault: v.isDefault })),
        partnerAdjustments
      );
    }
  }

  const marja = kpis.marjaOperationala;

  // §8 — Operating/Investing/Financing split.
  // Prev cash-end comes from the trends array (penultimate point), with a
  // sensible 0 fallback when we don't have a prior month yet.
  const currentCashEnd = summary.soldRegistruCasa + summary.soldConturiBancare;
  const prevTrend = trends[trends.length - 2];
  const prevCashEnd = prevTrend ? prevTrend.cashEnd : currentCashEnd - summary.cifraAfaceriLuna + summary.cheltuieliLuna;
  const cashflowBreakdown = computeCashflowBreakdown(
    rows,
    catalog,
    prevCashEnd,
    currentCashEnd
  );

  // §12 Patrimoniu
  const patrimoniu = computePatrimoniu(rows, catalog, year, month);

  // §9 Top customers/suppliers by activity this month
  const topCustomersByActivity = computeTopCustomersByActivity(rows);
  const topSuppliersByActivity = computeTopSuppliersByActivity(rows);

  // §6 Verdict + KPI strip
  const verdict = computeVerdict(summary, cashPosition, runway, yoy, marja);
  const kpiStrip = computeKpiStrip(
    summary,
    cashPosition,
    runway,
    rows,
    catalog,
    topCustomersByActivity
  );

  // §10 Health composite + ratios
  const healthScore = computeHealthScore(summary, runway, marja, patrimoniu);
  const ratios = computeRatios(summary, patrimoniu, runway, marja, yoy);

  // §11 Obligations calendar
  const obligations = computeObligations(rows, year, month);

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
    verdict,
    kpiStrip,
    cashflowBreakdown,
    obligations,
    healthScore,
    ratios,
    patrimoniu,
    topCustomersByActivity,
    topSuppliersByActivity,
    dataQuality: computeDataQuality(
      rows,
      catalog,
      resolverState,
      partnerOverrides,
      partnerAdjustments
    ),
  };
}

/**
 * Sprint 7 trust signal. Computes the same coverage % as the Mapari
 * Cashflow loader but inline here so we don't double-fetch — the rows,
 * resolver, overrides and adjustments are already loaded.
 *
 * Semantics match CoverageStats.percent in src/modules/categories/loader.ts:
 *   rulaj = |natural-side| per class 6+7 leaf cont
 *   mapped = cont has a category mapping OR has partner-overridden rulaj
 *   percent = mappedRulaj / totalRulaj rounded
 *
 * Hidden in the UI when hasAnyReview is false — a 0% coverage badge
 * would actively damage trust.
 */
function computeDataQuality(
  rows: BalanceRowView[],
  _catalog: Map<string, CatalogAccount>,
  resolverState: ResolverState | null,
  partnerOverrides: Awaited<ReturnType<typeof listOverridesForClient>>,
  partnerAdjustments: Awaited<ReturnType<typeof loadPartnerCategoryAdjustments>>
) {
  // Per-analytic partner-overridden rulaj for the period.
  const overriddenByAnalytic = new Map<string, number>();
  for (const adj of partnerAdjustments) {
    overriddenByAnalytic.set(
      adj.analyticCont,
      (overriddenByAnalytic.get(adj.analyticCont) ?? 0) + adj.amount
    );
  }

  let totalRulaj = 0;
  let mappedRulaj = 0;

  for (const row of rows) {
    if (!row.isLeaf) continue;
    const first = row.contBase.charAt(0);
    if (first !== "6" && first !== "7") continue;
    const rulaj = Math.abs(first === "6" ? row.rulajTD : row.rulajTC);
    if (rulaj < 0.01) continue;
    totalRulaj += rulaj;

    const hasContMapping =
      resolverState !== null &&
      resolveCategoryForCont(row.cont, resolverState) !== null;
    if (hasContMapping) {
      mappedRulaj += rulaj;
    } else {
      const overridden = overriddenByAnalytic.get(row.cont) ?? 0;
      mappedRulaj += Math.min(Math.abs(overridden), rulaj);
    }
  }

  const percent =
    totalRulaj === 0 ? 100 : Math.round((mappedRulaj / totalRulaj) * 100);

  // hasAnyReview: at least one cont-mapping OR one partner override exists.
  // Used by the UI to hide the badge entirely on freshly-imported firms
  // where claiming 'reviewed' would be dishonest.
  const hasAnyMapping = resolverState !== null && resolverState.byCont.size > 0;

  return {
    coveragePercent: percent,
    partnerOverrideCount: partnerOverrides.length,
    hasAnyReview: hasAnyMapping || partnerOverrides.length > 0,
  };
}

// loadPartnerAdjustmentsForPeriod removed — replaced by the shared
// loadPartnerCategoryAdjustments helper in @/modules/partner-mappings so the
// owner snapshot and the Mapari Cashflow loader use the exact same code path.
