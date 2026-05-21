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

export interface MapariCashflowData {
  clientId: string;
  /** The full category tree for this client. */
  tree: CostCategoryNode[];
  /** Period whose rulaj amounts appear next to each account (UI hint:
   *  "rulaj aprilie 2026"). null when the client has no journal data. */
  period: { year: number; month: number } | null;
  /** Class 6 + 7 leaves with rulaj. Sorted desc by abs(rulajD + rulajC). */
  accounts: AccountListItem[];
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
  clientId: string
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

  // Find the latest period the client has data for. If none, return early —
  // the tab will show an empty-state and the accountant uploads a journal
  // first.
  const periods = await getAvailablePeriods(clientId);
  if (periods.length === 0) {
    return {
      clientId,
      tree,
      period: null,
      accounts: [],
      freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
      verticalsEnabled,
      verticals,
    };
  }

  // getAvailablePeriods returns periods ASC (oldest first). Take the last
  // entry so we always show the most recent month with journal data — that's
  // what the contabil wants to configure (current state of the firm), not
  // the founding month from years ago.
  const latest = periods[periods.length - 1];
  const balanceResult = await getBalanceRows(clientId, latest.year, latest.month);
  if (!balanceResult.ok) {
    return {
      clientId,
      tree,
      period: { year: latest.year, month: latest.month },
      accounts: [],
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

    accounts.push({
      cont: row.cont,
      contBase: row.contBase,
      denumire: row.denumire,
      kind: first === "6" ? "expense" : "revenue",
      rulajD: row.rulajD,
      rulajC: row.rulajC,
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
    period: { year: latest.year, month: latest.month },
    accounts,
    freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
    verticalsEnabled,
    verticals,
  };
}
