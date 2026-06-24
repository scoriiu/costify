/**
 * Line-trend loader (ADR-0004 PR-1).
 *
 * Builds the per-month series for the Mapari trend charts: linii de cost
 * (axa A, expense + revenue categories) and linii de business (axa B,
 * verticals). It loads the journal ONCE via prepareBalanceContext and derives
 * every month of the window as a pure in-memory slice, mirroring the
 * single-read discipline of loadOwnerSnapshot. No per-month DB reads.
 *
 * The mapping resolver is built once here and injected per (year, month)
 * through the engine's `resolverFor` seam. Today every month resolves with the
 * same global mapping, so the latest bar equals the breakdown card on the same
 * page. When PR-3 makes mappings period-scoped, only `resolverFor` changes to
 * an as-of resolver; this file and the engine stay untouched.
 *
 * Partner overrides: loaded once for the selected period and applied only to
 * that month's bar. Applying them to every historical month would cost one
 * journal read per month (the exact anti-pattern the snapshot refactor killed),
 * and the trend is a directional view. The selected bar therefore reconciles
 * with the detailed card; earlier bars use cont mappings only.
 */

import {
  prepareBalanceContext,
  computeBalanceFromContext,
} from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { prisma } from "@/lib/db";
import { periodKey } from "@/lib/period";
import {
  listCategoryTree,
  listMappingVersions,
  buildResolverStateAsOf,
} from "@/modules/categories";
import {
  listVerticals,
  listAllocationVersions,
  listCategoryAllocationVersions,
  listFirmDefaultVersions,
  buildVerticalResolverAsOf,
  type AllocationVersion,
  type CategoryAllocationVersion,
  type FirmDefaultVersion,
} from "@/modules/verticals";
import {
  listOverridesForClient,
  loadPartnerCategoryAdjustments,
} from "@/modules/partner-mappings";
import {
  computeCostLineSeries,
  computeBusinessLineSeries,
  type BusinessLineMetric,
  type LineSeries,
  type SeriesMonth,
} from "./line-series";
import {
  computeCategoryConfigChanges,
  type CategoryConfigChanges,
} from "./config-timeline";
import {
  computePeriodConfigOverview,
  type PeriodConfigItem,
} from "./config-overview";

const DEFAULT_WINDOW_MONTHS = 12;

export interface LoadLineTrendsInput {
  clientId: string;
  year: number;
  month: number;
  windowMonths?: number;
  businessMetric?: BusinessLineMetric;
}

export interface LineTrendsData {
  meta: {
    clientId: string;
    year: number;
    month: number;
    windowMonths: number;
  };
  months: SeriesMonth[];
  costExpense: LineSeries[];
  costRevenue: LineSeries[];
  business: LineSeries[];
  businessMetric: BusinessLineMetric;
  verticalsEnabled: boolean;
  /** Per cost-line (root category id) configuration changes per month, aligned
   *  to `months`. Powers the "how the line's definition evolved" drawer
   *  (ADR-0004 D10). Keyed by the same id the cost lines use. */
  configChanges: CategoryConfigChanges;
  /** Helicopter view: every target whose configuration CHANGES within the
   *  window, as a timeline of segments. Drives the "Configurari pe perioade"
   *  banner so the user sees period-scoped rules without scrubbing months. */
  configOverview: PeriodConfigItem[];
}

export async function loadLineTrends(
  input: LoadLineTrendsInput
): Promise<LineTrendsData> {
  const { clientId, year, month } = input;
  const windowMonths = input.windowMonths ?? DEFAULT_WINDOW_MONTHS;
  const businessMetric = input.businessMetric ?? "profit";

  const [balanceContext, catalog, clientFlag] = await Promise.all([
    prepareBalanceContext(clientId),
    getCatalogMap(),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { verticalsEnabled: true },
    }),
  ]);

  if (!balanceContext) {
    throw new Error(`Nu pot incarca datele clientului ${clientId}.`);
  }

  const [categoryTreeResult, mappingVersions, partnerOverrides] = await Promise.all([
    listCategoryTree(prisma, clientId, { autoSeed: false }),
    listMappingVersions(prisma, clientId),
    listOverridesForClient(prisma, clientId),
  ]);
  const tree = categoryTreeResult.tree;

  // Each month resolves with ITS OWN effective mapping (ADR-0004 D5). The
  // resolver is rebuilt per (year, month) over the in-memory version set, so a
  // cont reclassified in April shows on its old line for Jan-Mar and the new
  // line from April on. Memoized per period to avoid re-flattening the tree.
  const categoryResolverCache = new Map<number, ReturnType<typeof buildResolverStateAsOf>>();
  const categoryResolverFor = (y: number, m: number) => {
    const p = periodKey(y, m);
    let r = categoryResolverCache.get(p);
    if (!r) {
      r = buildResolverStateAsOf(tree, mappingVersions, p);
      categoryResolverCache.set(p, r);
    }
    return r;
  };

  const selectedAdjustments =
    partnerOverrides.length === 0
      ? []
      : await loadPartnerCategoryAdjustments(prisma, clientId, year, month);
  const adjustmentsFor = (y: number, m: number) =>
    y === year && m === month ? selectedAdjustments : [];

  const rowsFor = (y: number, m: number) =>
    computeBalanceFromContext(balanceContext, y, m);

  const expenseResult = computeCostLineSeries({
    endYear: year,
    endMonth: month,
    windowMonths,
    catalog,
    kind: "expense",
    rowsFor,
    resolverFor: categoryResolverFor,
    adjustmentsFor,
  });
  const revenueResult = computeCostLineSeries({
    endYear: year,
    endMonth: month,
    windowMonths,
    catalog,
    kind: "revenue",
    rowsFor,
    resolverFor: categoryResolverFor,
    adjustmentsFor,
  });

  const verticalsEnabled = clientFlag?.verticalsEnabled ?? false;
  let business: LineSeries[] = [];
  let verticalsList: { id: string; name: string }[] = [];
  let allocVersions: AllocationVersion[] = [];
  let catAllocVersions: CategoryAllocationVersion[] = [];
  let firmVersions: FirmDefaultVersion[] = [];
  if (verticalsEnabled) {
    const [verticals, av, cav, fv] = await Promise.all([
      listVerticals(prisma, clientId),
      listAllocationVersions(prisma, clientId),
      listCategoryAllocationVersions(prisma, clientId),
      listFirmDefaultVersions(prisma, clientId),
    ]);
    allocVersions = av;
    catAllocVersions = cav;
    firmVersions = fv;
    verticalsList = verticals.map((v) => ({ id: v.id, name: v.name }));
    if (verticals.length > 0) {
      const defaultVerticalId = verticals.find((v) => v.isDefault)?.id ?? null;
      const verticalResolverCache = new Map<
        number,
        ReturnType<typeof buildVerticalResolverAsOf>
      >();
      const verticalResolverFor = (y: number, m: number) => {
        const p = periodKey(y, m);
        let r = verticalResolverCache.get(p);
        if (!r) {
          r = buildVerticalResolverAsOf(
            allocVersions,
            defaultVerticalId,
            catAllocVersions,
            firmVersions,
            p
          );
          verticalResolverCache.set(p, r);
        }
        return r;
      };
      business = computeBusinessLineSeries({
        endYear: year,
        endMonth: month,
        windowMonths,
        metric: businessMetric,
        catalog,
        verticals: verticals.map((v) => ({
          id: v.id,
          name: v.name,
          isDefault: v.isDefault,
        })),
        rowsFor,
        resolverFor: verticalResolverFor,
        categoryResolverFor,
        adjustmentsFor,
      }).lines;
    }
  }

  const configChanges = computeCategoryConfigChanges(
    tree,
    mappingVersions,
    expenseResult.months
  );

  // Latest month with journal data, so the overview timeline can show reverts
  // that happen AFTER the month the user is currently viewing.
  let latestKey = periodKey(year, month);
  let latestYear = year;
  let latestMonth = month;
  for (const e of balanceContext.entries) {
    const k = periodKey(e.year, e.month);
    if (k > latestKey) {
      latestKey = k;
      latestYear = e.year;
      latestMonth = e.month;
    }
  }

  const configOverview = computePeriodConfigOverview({
    latestYear,
    latestMonth,
    selectedYear: year,
    selectedMonth: month,
    windowMonths,
    tree,
    verticals: verticalsList,
    catalog,
    mappingVersions,
    allocVersions,
    catAllocVersions,
    firmVersions,
    verticalsEnabled,
  });

  return {
    meta: { clientId, year, month, windowMonths },
    months: expenseResult.months,
    costExpense: expenseResult.lines,
    costRevenue: revenueResult.lines,
    business,
    businessMetric,
    verticalsEnabled,
    configChanges,
    configOverview,
  };
}
