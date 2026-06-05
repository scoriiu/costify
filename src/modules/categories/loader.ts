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
import { getAvailablePeriods } from "@/modules/balances";
import { getBalanceRowsCached } from "@/modules/cache/loaders";
import {
  listVerticals,
  listAllocations,
  listCategoryAllocations,
  listPartnerAllocations,
  getFirmDefaultSplits,
  buildVerticalResolver,
  resolveAllocationForCont,
  type VerticalView,
  type AllocationView,
  type CategoryAllocationView,
  type AllocationSplit,
  type AllocationScope,
} from "@/modules/verticals";
import {
  loadPartnerSummariesForClient,
  loadPartnerCategoryAdjustments,
  type PartnerSummary,
  type PartnerCategoryAdjustment,
} from "@/modules/partner-mappings";
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
  /** The split this cont ACTUALLY resolves to through the full cascade
   *  (own rule → category → firm-top → legacy default), plus where it came
   *  from. Lets the UI label each row honestly: "Regula proprie" vs "Urmeaza
   *  categoria" vs "Urmeaza firma". `source`:
   *    - "own"      — the cont has its own VerticalAllocation row
   *    - "category" — inherited from the cont's CostCategory split
   *    - "firm"     — inherited from the firm-top default
   *    - "default"  — legacy fallback (default vertical 100%) */
  effectiveAllocation: {
    splits: AllocationSplit[];
    source: "own" | "category" | "firm" | "default";
  };
  /** True when this analytic cont has its own allocation row (overrides base). */
  hasAnalyticVerticalOverride: boolean;
  /** Number of distinct partners that touched this cont in the period
   *  (resolved via JournalPartner). Includes override-only partners with
   *  zero rulaj — see PartnerSummary for details. */
  partnerCount: number;
  /** Of those partners, how many have an active PartnerCategoryOverride.
   *  Drives the per-cont coverage bar in the slide-panel and the
   *  "[Vezi parteneri →]" badge in the main listing. */
  partnerOverrideCount: number;
  /** Sum of rulaj that flows through partners with an active override.
   *  Sprint 6 will use this in residual computation. */
  partnerOverriddenRulaj: number;
  /** Number of partners on this cont that have their OWN line-of-business
   *  split (PartnerVerticalAllocation), differing from the cont's split.
   *  > 0 → show the "some partners split differently" marker on the row. */
  partnerLobOverrideCount: number;
}

/**
 * Overall coverage of the firm's class 6+7 accounts at the time of the
 * selected period.
 *
 * Sprint 2 definition of "mapped":
 *   - The cont itself has a category mapping (Sprint 1 baseline),
 *     OR
 *   - The cont has at least one partner-level override and that
 *     override's rulaj is part of the mapped total.
 *
 * Concretely: a cont with no cont-mapping but 3 partner overrides covering
 * 80% of its rulaj is "80% covered" for that cont, not "0% covered". The
 * remaining 20% of the cont's rulaj is unmapped (will fall through to
 * "Alte" on the antreprenor view in Sprint 6).
 *
 * Shape unchanged from Sprint 1 — the UI doesn't need changes.
 */
export interface CoverageStats {
  /** Sum of |rulajD| for class 6 + |rulajC| for class 7 across every
   *  active leaf account in the period. */
  totalRulaj: number;
  /** Mapped via cont-mapping OR partner override. */
  mappedRulaj: number;
  /** totalRulaj − mappedRulaj. */
  unmappedRulaj: number;
  /** Round(mappedRulaj / totalRulaj * 100), or 100 when totalRulaj === 0
   *  (vacuously full coverage if there's nothing to map). */
  percent: number;
  /** Count of leaf accounts where currentMapping IS null AND no partner
   *  override exists for the contBase. */
  unmappedCount: number;
  /** Count of all leaf accounts. */
  totalAccountCount: number;
}

/** One source of inflow into a category via the partner-override residue
 *  pathway: a specific cont diverted N lei from its default category to this
 *  category. Surfaced on the category marker tooltip so the contabil sees
 *  exactly which conts are feeding the residue. */
export interface CategoryInflowSource {
  cont: string;
  amount: number;
}

export interface CategoryInflow {
  /** Sum of redirected rulaj from all sources for this category in the period. */
  amount: number;
  /** Per-cont breakdown, sorted desc by amount. */
  sources: CategoryInflowSource[];
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
  /** All (year, month) periods for which the client has journal data, sorted
   *  ASC. The UI uses this to populate the month selector for the chosen year. */
  availablePeriods: { year: number; month: number }[];
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
  /** Per-contBase partner summary for the period. Drives per-cont coverage
   *  bars and the "[Vezi parteneri →]" badge. Missing key = no partner
   *  activity / overrides for that cont this period. */
  partnerSummariesByCont: Record<string, PartnerSummary>;
  /** Category-level vertical allocations (one row per category that has set
   *  its own horizontal). Empty when the firm has no category allocations.
   *  Used by the edit-allocation dialog to show current state and by the
   *  marker tooltip to phrase "se duc 100% pe Outsourcing" vs "se duc pe
   *  Toata firma". */
  categoryAllocations: CategoryAllocationView[];
  /** The firm-top default split — the top of the cascade. null = not
   *  configured (everything falls through to the legacy "Toata firma"
   *  vertical). Drives the firm-level split setter on the top band. */
  firmDefaultSplits: AllocationSplit[] | null;
  /** Per-categoryId map of incoming residue from partner overrides in the
   *  period. Missing key = the category receives no residue. Drives the
   *  inflow marker on the category row + tooltip detail. */
  categoryInflows: Record<string, CategoryInflow>;
  /** Total residue lei absorbed by the firm's default vertical because the
   *  target category has no explicit allocation. Drives the tooltip on the
   *  "Toata firma" column header in the Verticale tab.
   *  0 when the firm has no overrides, no verticals enabled, or every
   *  targeted category has its own allocation. */
  defaultVerticalResidueAbsorbed: number;
}

export async function loadMapariCashflow(
  clientId: string,
  opts?: { year?: number; month?: number }
): Promise<MapariCashflowData> {
  // Phase 1 — sequential: tree+autoSeed may insert default categories AND
  // default mappings, so we cannot parallelize listMappings with this call.
  // In steady state (post-first-load) this is one indexed SELECT.
  const { tree, seeded } = await listCategoryTree(prisma, clientId, {
    autoSeed: true,
  });

  // Phase 2 — parallel: every metadata query the page needs. Six independent
  // SELECTs in one round-trip latency window (~10-20 ms instead of 50-80 ms
  // sequential).
  const [
    mappings,
    clientFlag,
    verticals,
    allocations,
    categoryAllocations,
    firmDefaultSplits,
    periods,
    partnerAllocations,
  ] = await Promise.all([
    listMappings(prisma, clientId),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { verticalsEnabled: true },
    }),
    listVerticals(prisma, clientId),
    listAllocations(prisma, clientId),
    listCategoryAllocations(prisma, clientId),
    getFirmDefaultSplits(prisma, clientId),
    getAvailablePeriods(clientId),
    listPartnerAllocations(prisma, clientId),
  ]);

  const verticalsEnabled = clientFlag?.verticalsEnabled ?? false;
  const emptyPartnerSummaries: Record<string, PartnerSummary> = {};
  const emptyCategoryInflows: Record<string, CategoryInflow> = {};
  const categoryAllocationIds = new Set(
    categoryAllocations.map((ca) => ca.categoryId)
  );

  // Build a full resolver state so the UI uses the same prefix-walk semantics
  // as the snapshot computation. A leaf cont like "704" must resolve to the
  // 2-digit root mapping on "70", and "641.001" must resolve to the 3-digit
  // sub-category mapping on "641" before falling back to "64".
  const resolverState = buildResolverState(tree, mappings);

  // Vertical resolver mirrors the snapshot cascade so the per-cont "effective
  // split" shown in the UI matches what the owner report computes. Needs the
  // default vertical id; if verticals aren't enabled there is none and we skip
  // effective-split resolution (UI hides that column anyway).
  const defaultVerticalId = verticals.find((v) => v.isDefault)?.id ?? null;
  const verticalResolver = verticalsEnabled
    ? buildVerticalResolver(
        allocations,
        defaultVerticalId,
        categoryAllocations,
        firmDefaultSplits
      )
    : null;

  const allocByCont = new Map<string, AllocationView>();
  for (const a of allocations) allocByCont.set(a.cont, a);

  // How many partners on each cont carry their OWN line-of-business split
  // (a PartnerVerticalAllocation), overriding the cont's split. Drives the
  // "some partners split differently" marker on the cont row.
  const partnerLobOverridesByContBase = new Map<string, number>();
  for (const a of partnerAllocations) {
    partnerLobOverridesByContBase.set(
      a.contBase,
      (partnerLobOverridesByContBase.get(a.contBase) ?? 0) + 1
    );
  }
  const availableYears = Array.from(new Set(periods.map((p) => p.year))).sort(
    (a, b) => b - a
  );
  const availablePeriods = periods.map((p) => ({ year: p.year, month: p.month }));
  if (periods.length === 0) {
    return {
      clientId,
      tree,
      period: null,
      availableYears: [],
      availablePeriods: [],
      accounts: [],
      coverage: computeCoverage([]),
      freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
      verticalsEnabled,
      verticals,
      partnerSummariesByCont: emptyPartnerSummaries,
      categoryAllocations,
      firmDefaultSplits,
      categoryInflows: emptyCategoryInflows,
      defaultVerticalResidueAbsorbed: 0,
    };
  }

  // Pick the working year: explicit if provided & data exists, otherwise the
  // newest year in the journal. Periods are ASC, so periods[N-1] is newest.
  const newestYear = periods[periods.length - 1].year;
  const targetYear =
    opts?.year !== undefined && availableYears.includes(opts.year)
      ? opts.year
      : newestYear;

  // Inside the chosen year, honour an explicit month if it has data; otherwise
  // take the latest month with data — so the default YTD numbers reflect the
  // firm's state as of the most recent close (e.g. Jan→Apr for 2026 in flight,
  // Jan→Dec for closed years). The accountant can pick any earlier month to see
  // the cumulative picture through that month (Jan→selected).
  const monthsForYear = periods
    .filter((p) => p.year === targetYear)
    .map((p) => p.month);
  const latestMonth =
    opts?.month !== undefined && monthsForYear.includes(opts.month)
      ? opts.month
      : Math.max(...monthsForYear);
  const [balanceResult, partnerSummariesByCont, partnerAdjustments] = await Promise.all([
    getBalanceRowsCached(clientId, targetYear, latestMonth),
    loadPartnerSummariesForClient(prisma, clientId, targetYear, latestMonth),
    loadPartnerCategoryAdjustments(prisma, clientId, targetYear, latestMonth),
  ]);
  const categoryInflows = aggregateCategoryInflows(partnerAdjustments);
  const defaultVerticalResidueAbsorbed = sumDefaultVerticalAbsorption(
    partnerAdjustments,
    categoryAllocationIds
  );
  if (!balanceResult.ok) {
    return {
      clientId,
      tree,
      period: { year: targetYear, month: latestMonth },
      availableYears,
      availablePeriods,
      accounts: [],
      coverage: computeCoverage([]),
      freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
      verticalsEnabled,
      verticals,
      partnerSummariesByCont,
      categoryAllocations,
      firmDefaultSplits,
      categoryInflows,
      defaultVerticalResidueAbsorbed,
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
    // Partner summary is keyed by contBase — multiple analytic conts under
    // the same contBase share the same summary (it's a contBase-level metric,
    // matching the PartnerCategoryOverride grain). Missing key = no partner
    // activity / overrides for this cont this period.
    const partnerSummary = partnerSummariesByCont[row.contBase];

    // Effective split through the full cascade (own → category → firm →
    // legacy). categoryPath is leaf→root so the resolver picks the most
    // specific category that has a split. When verticals are off there is no
    // resolver and the UI hides this; we still emit a stable shape.
    const categoryPath = resolved ? resolved.path.map((n) => n.id).reverse() : [];
    const effective = verticalResolver
      ? resolveAllocationForCont(row.cont, verticalResolver, categoryPath)
      : null;
    const effectiveAllocation: AccountListItem["effectiveAllocation"] = effective
      ? {
          splits: effective.splits,
          source:
            effective.matchedScope === "analytic" ||
            effective.matchedScope === "contBase"
              ? "own"
              : effective.matchedScope === "category"
              ? "category"
              : effective.matchedScope === "firm"
              ? "firm"
              : "default",
        }
      : { splits: [], source: "default" };

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
      effectiveAllocation,
      hasAnalyticVerticalOverride: analyticAlloc !== undefined,
      partnerCount: partnerSummary?.partnerCount ?? 0,
      partnerOverrideCount: partnerSummary?.mappedPartnerCount ?? 0,
      partnerOverriddenRulaj: partnerSummary?.overriddenRulaj ?? 0,
      partnerLobOverrideCount:
        partnerLobOverridesByContBase.get(row.contBase) ?? 0,
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
    availablePeriods,
    accounts,
    coverage: computeCoverage(accounts),
    freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
    verticalsEnabled,
    verticals,
    partnerSummariesByCont,
    categoryAllocations,
    firmDefaultSplits,
    categoryInflows,
    defaultVerticalResidueAbsorbed,
  };
}

/**
 * Sum of residue amounts that fall through to the firm's default vertical
 * because the target category has no explicit allocation. Pure — exported
 * for unit testing.
 */
export function sumDefaultVerticalAbsorption(
  adjustments: PartnerCategoryAdjustment[],
  categoryIdsWithAllocation: Set<string>
): number {
  let sum = 0;
  for (const adj of adjustments) {
    if (!categoryIdsWithAllocation.has(adj.targetCategoryId)) {
      sum += adj.amount;
    }
  }
  return round2(sum);
}

/**
 * Aggregate PartnerCategoryAdjustment[] into a per-categoryId map of inflow
 * + sources. Pure — exported for unit testing.
 */
export function aggregateCategoryInflows(
  adjustments: PartnerCategoryAdjustment[]
): Record<string, CategoryInflow> {
  const out: Record<string, CategoryInflow> = {};
  for (const adj of adjustments) {
    const entry =
      out[adj.targetCategoryId] ?? { amount: 0, sources: [] };
    entry.amount = round2(entry.amount + adj.amount);
    // Bucket sources by cont (analytics for same cont sum together).
    const existing = entry.sources.find((s) => s.cont === adj.analyticCont);
    if (existing) {
      existing.amount = round2(existing.amount + adj.amount);
    } else {
      entry.sources.push({ cont: adj.analyticCont, amount: round2(adj.amount) });
    }
    out[adj.targetCategoryId] = entry;
  }
  // Sort sources within each category desc by amount.
  for (const cat of Object.values(out)) {
    cat.sources.sort((a, b) => b.amount - a.amount);
  }
  return out;
}

/**
 * Pure computation of overall mapping coverage. Exported so the unit suite
 * (tests/unit/modules/categories/) can verify edge cases (empty firm, all
 * mapped, all unmapped, mixed) without hitting the database.
 *
 * Sprint 2 semantics:
 *
 *   For each cont, rulaj = |rulajD| for class 6, |rulajC| for class 7.
 *   This rulaj contributes to mappedRulaj when either:
 *     (a) The cont itself has a category mapping (currentMapping !== null),
 *         in which case its entire rulaj counts as mapped, OR
 *     (b) The cont has no cont-mapping but has partner-overridden rulaj,
 *         in which case only that overridden portion counts as mapped.
 *
 *   A cont is "unmapped" (counted in unmappedCount) only when BOTH:
 *     - currentMapping is null, AND
 *     - partnerOverriddenRulaj === 0 (no partner overrides at all).
 *   A cont with no cont-mapping but with partner overrides is "partially
 *   mapped" and not counted toward unmappedCount — it has SOMETHING.
 *
 *   For unmapped portions of a cont with partial coverage, those flow into
 *   unmappedRulaj naturally as (totalRulaj - mappedRulaj).
 *
 *   Sums use absolute values so a negative correction cont doesn't
 *   subtract from coverage.
 */
export function computeCoverage(accounts: AccountListItem[]): CoverageStats {
  let totalRulaj = 0;
  let mappedRulaj = 0;
  let unmappedCount = 0;

  for (const a of accounts) {
    const rulaj = Math.abs(a.kind === "expense" ? a.rulajD : a.rulajC);
    totalRulaj += rulaj;

    if (a.currentMapping !== null) {
      // Cont-mapped: the whole rulaj is covered. Partner overrides under a
      // cont-mapped cont are redundant for coverage purposes (Sprint 6 will
      // use them to refine which CATEGORY the rulaj goes to, but for
      // "is this cont covered" the answer is already yes).
      mappedRulaj += rulaj;
    } else if (a.partnerOverriddenRulaj > 0) {
      // Cont not mapped but partially covered by partner overrides. Only the
      // overridden portion counts as mapped; the remainder is unmapped.
      // Cap at rulaj so float drift doesn't push us above the cont's total.
      mappedRulaj += Math.min(Math.abs(a.partnerOverriddenRulaj), rulaj);
    } else {
      // Fully unmapped — no cont-mapping, no partner overrides.
      unmappedCount += 1;
    }
  }

  const unmappedRulaj = Math.max(0, totalRulaj - mappedRulaj);
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
