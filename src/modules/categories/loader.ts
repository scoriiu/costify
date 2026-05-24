/**
 * Server-side loader for the "Mapari Cashflow" tab.
 *
 * Aggregates everything the UI needs in one round-trip:
 *   - the full category tree (auto-seeded if the client has none),
 *   - the list of mappings,
 *   - the list of class 6/7 leaf accounts present in the journal, with
 *     their cumulative rulaj for the last available month (so the
 *     accountant sees what the firm actually moves through each account).
 *
 * Returns a serializable shape — the React tree can render it directly
 * without any further server calls.
 */

import { prisma } from "@/lib/db";
import { round2 } from "@/lib/money";
import { listCategoryTree, listMappings } from "./service";
import { buildResolverState, resolveCategoryForCont } from "./resolver";
import { getAvailablePeriods, getBalanceRows } from "@/modules/balances";
import {
  listVerticals,
  listAllocations,
  type VerticalView,
  type AllocationView,
  type AllocationSplit,
  type AllocationScope,
} from "@/modules/verticals";
import type { CostCategoryNode, MappingScope } from "./types";

export interface AccountListItem {
  /** Full analytic cont as it appears in the journal ("628.01"). */
  cont: string;
  /** Base code (3-digit usually, "628"). */
  contBase: string;
  /** Display name from the resolver chain (catalog or partner). */
  denumire: string;
  /** Account class: "expense" if class 6, "revenue" if class 7. */
  kind: "expense" | "revenue";
  /** Cumulative debit for the period (used as "rulaj" for class 6). */
  rulajD: number;
  /** Cumulative credit for the period (used as "rulaj" for class 7). */
  rulajC: number;
  /** Current mapping, if any. */
  currentMapping: {
    categoryId: string;
    scope: MappingScope;
  } | null;
  /** True when this cont has an analytic-scope override of the base. */
  hasAnalyticOverride: boolean;
  /** Current vertical allocation, if any. null = inherits the firm default. */
  currentAllocation: {
    scope: AllocationScope;
    splits: AllocationSplit[];
  } | null;
  /** True when this analytic cont has its own allocation row (overrides base). */
  hasAnalyticVerticalOverride: boolean;
}

/**
 * Overall coverage of the firm's class 6+7 accounts at the time of the
 * selected period. At Sprint 1 of the Mapari Cashflow rewrite this is
 * a binary cont-level metric — an account is either mapped to a category
 * or not. From Sprint 2 onwards (partner overrides) the meaning of
 * "mapped" extends to "covered by an explicit partner mapping OR by the
 * cont's default category"; the shape of CoverageStats stays the same so
 * the UI doesn't have to change.
 */
export interface CoverageStats {
  /** Sum of |rulajD| for class 6 + |rulajC| for class 7 across every
   *  active leaf account in the period. */
  totalRulaj: number;
  /** The same sum, restricted to accounts with currentMapping !== null. */
  mappedRulaj: number;
  /** totalRulaj − mappedRulaj. */
  unmappedRulaj: number;
  /** Round(mappedRulaj / totalRulaj * 100), or 100 when totalRulaj === 0
   *  (vacuously full coverage if there's nothing to map). */
  percent: number;
  /** Count of distinct leaf accounts with currentMapping === null. */
  unmappedCount: number;
  /** Count of all leaf accounts (mapped + unmapped). */
  totalAccountCount: number;
}

export interface MapariCashflowData {
  clientId: string;
  /** The full category tree for this client. */
  tree: CostCategoryNode[];
  /** Period whose rulaj amounts appear next to each account. The rulaj values
   *  are YTD-cumulated through this month inside the selected year (so for
   *  Jan→April 2026 you see the running total Jan→Apr, not just April).
   *  null when the client has no journal data. */
  period: { year: number; month: number } | null;
  /** All years for which the client has journal data, sorted DESC (newest
   *  first). The UI uses this to populate the year selector. */
  availableYears: number[];
  /** Class 6 + 7 leaves with rulaj. Sorted desc by abs(rulajD + rulajC). */
  accounts: AccountListItem[];
  /** Overall mapping coverage for the selected period. Header surfaces this
   *  as a progress bar + actionable callouts. */
  coverage: CoverageStats;
  /** True when this load triggered an OMFP auto-seed (UI can show a one-shot
   *  toast: "Am pornit cu taxonomia OMFP. Editeaz-o cum vrei."). */
  freshlySeeded: boolean;
  /** True when the client has verticalsEnabled. UI shows the second column
   *  only in this case. */
  verticalsEnabled: boolean;
  /** The list of verticals for this client. Empty when the flag is off. */
  verticals: VerticalView[];
}

export async function loadMapariCashflow(
  clientId: string,
  opts?: { year?: number }
): Promise<MapariCashflowData> {
  const { tree, seeded } = await listCategoryTree(prisma, clientId, {
    autoSeed: true,
  });
  const mappings = await listMappings(prisma, clientId);

  // Fetch vertical state (flag, list, allocations) in parallel.
  const [clientFlag, verticals, allocations] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { verticalsEnabled: true },
    }),
    listVerticals(prisma, clientId),
    listAllocations(prisma, clientId),
  ]);
  const verticalsEnabled = clientFlag?.verticalsEnabled ?? false;

  // Build a full resolver state so the UI uses the same prefix-walk semantics
  // as the snapshot computation. A leaf cont like "704" must resolve to the
  // 2-digit root mapping on "70", and "641.001" must resolve to the 3-digit
  // sub-category mapping on "641" before falling back to "64".
  const resolverState = buildResolverState(tree, mappings);

  const allocByCont = new Map<string, AllocationView>();
  for (const a of allocations) allocByCont.set(a.cont, a);

  // Find every period the client has data for. Empty -> empty-state.
  const periods = await getAvailablePeriods(clientId);
  const availableYears = Array.from(new Set(periods.map((p) => p.year))).sort(
    (a, b) => b - a
  );
  if (periods.length === 0) {
    return {
      clientId,
      tree,
      period: null,
      availableYears: [],
      accounts: [],
      coverage: computeCoverage([]),
      freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
      verticalsEnabled,
      verticals,
    };
  }

  // Pick the working year: explicit if provided & data exists, otherwise the
  // newest year in the journal. Periods are ASC, so periods[N-1] is newest.
  const newestYear = periods[periods.length - 1].year;
  const targetYear =
    opts?.year !== undefined && availableYears.includes(opts.year)
      ? opts.year
      : newestYear;

  // Inside the chosen year, take the latest month with data — so YTD numbers
  // reflect the firm's state as of the most recent close (e.g. Jan→Apr for
  // 2026 in flight, Jan→Dec for closed years).
  const monthsForYear = periods
    .filter((p) => p.year === targetYear)
    .map((p) => p.month);
  const latestMonth = Math.max(...monthsForYear);
  const balanceResult = await getBalanceRows(clientId, targetYear, latestMonth);
  if (!balanceResult.ok) {
    return {
      clientId,
      tree,
      period: { year: targetYear, month: latestMonth },
      availableYears,
      accounts: [],
      coverage: computeCoverage([]),
      freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
      verticalsEnabled,
      verticals,
    };
  }

  const accounts: AccountListItem[] = [];
  for (const row of balanceResult.data) {
    if (!row.isLeaf) continue;
    if (row.isExtraBilantier) continue;
    const first = row.contBase.charAt(0);
    if (first !== "6" && first !== "7") continue;

    // Resolve the mapping via the full prefix-walk semantics — so "704"
    // finds the "70" root, "641.001" finds the "641" sub-category, etc.
    // matchedScope is null only for the hardcoded OMFP fallback path, which
    // we treat as a real "contBase" match here for UI purposes (the row is
    // mapped, just not through a user-editable mapping row).
    const resolved = resolveCategoryForCont(row.cont, resolverState);
    const current = resolved
      ? {
          categoryId: resolved.category.id,
          scope: resolved.matchedScope ?? "contBase",
        }
      : null;
    const hasAnalyticOverride = resolved?.matchedScope === "analytic";

    const analyticAlloc = allocByCont.get(row.cont);
    const baseAlloc = allocByCont.get(row.contBase);
    const allocation =
      analyticAlloc?.scope === "analytic"
        ? analyticAlloc
        : baseAlloc?.scope === "contBase"
        ? baseAlloc
        : null;

    // Use YTD-cumulated rulaj (rulajTD/rulajTC) instead of single-month
    // (rulajD/rulajC) so the contabil sees the year-to-date picture for the
    // selected year. For a closed year (e.g. 2025 Jan→Dec), this is the full
    // year. For an in-flight year (2026 Jan→Apr today), it is Jan→Apr — the
    // running total, which is the right reference point for category review.
    accounts.push({
      cont: row.cont,
      contBase: row.contBase,
      denumire: row.denumire,
      kind: first === "6" ? "expense" : "revenue",
      rulajD: row.rulajTD,
      rulajC: row.rulajTC,
      currentMapping: current,
      hasAnalyticOverride,
      currentAllocation: allocation
        ? { scope: allocation.scope, splits: allocation.splits }
        : null,
      hasAnalyticVerticalOverride: analyticAlloc !== undefined,
    });
  }

  // Sort by absolute rulaj desc — biggest movers first, so the accountant
  // configures what matters before the long tail of small accounts.
  accounts.sort(
    (a, b) =>
      Math.abs(b.rulajD) + Math.abs(b.rulajC) -
      (Math.abs(a.rulajD) + Math.abs(a.rulajC))
  );

  return {
    clientId,
    tree,
    period: { year: targetYear, month: latestMonth },
    availableYears,
    accounts,
    coverage: computeCoverage(accounts),
    freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
    verticalsEnabled,
    verticals,
  };
}

/**
 * Pure computation of overall mapping coverage. Exported so the unit suite
 * (tests/unit/modules/categories/) can verify edge cases (empty firm, all
 * mapped, all unmapped, mixed) without hitting the database.
 *
 * Sprint 1 semantics: an account is "mapped" iff its currentMapping is
 * non-null. Rulaj is taken from the cont's natural side (rulajD for class 6,
 * rulajC for class 7). Sums are absolute values so a negative correction
 * cont doesn't subtract from coverage.
 *
 * Sprint 2 will extend "mapped" to include partner-level overrides but the
 * shape of the result stays the same.
 */
export function computeCoverage(accounts: AccountListItem[]): CoverageStats {
  let totalRulaj = 0;
  let mappedRulaj = 0;
  let unmappedCount = 0;

  for (const a of accounts) {
    const rulaj = Math.abs(a.kind === "expense" ? a.rulajD : a.rulajC);
    totalRulaj += rulaj;
    if (a.currentMapping !== null) {
      mappedRulaj += rulaj;
    } else {
      unmappedCount += 1;
    }
  }

  const unmappedRulaj = totalRulaj - mappedRulaj;
  const percent =
    totalRulaj === 0 ? 100 : Math.round((mappedRulaj / totalRulaj) * 100);

  return {
    totalRulaj: round2(totalRulaj),
    mappedRulaj: round2(mappedRulaj),
    unmappedRulaj: round2(unmappedRulaj),
    percent,
    unmappedCount,
    totalAccountCount: accounts.length,
  };
}
