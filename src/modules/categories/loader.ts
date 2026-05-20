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
import { getAvailablePeriods, getBalanceRows } from "@/modules/balances";
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
}

export async function loadMapariCashflow(
  clientId: string
): Promise<MapariCashflowData> {
  const { tree, seeded } = await listCategoryTree(prisma, clientId, {
    autoSeed: true,
  });
  const mappings = await listMappings(prisma, clientId);

  // Index mappings for O(1) lookup per cont.
  const byCont = new Map<string, { categoryId: string; scope: MappingScope }>();
  for (const m of mappings) byCont.set(m.cont, { categoryId: m.categoryId, scope: m.scope });

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
    };
  }

  const latest = periods[0]; // already sorted desc by service
  const balanceResult = await getBalanceRows(clientId, latest.year, latest.month);
  if (!balanceResult.ok) {
    return {
      clientId,
      tree,
      period: { year: latest.year, month: latest.month },
      accounts: [],
      freshlySeeded: seeded !== null && seeded.categoriesCreated > 0,
    };
  }

  const accounts: AccountListItem[] = [];
  for (const row of balanceResult.data) {
    if (!row.isLeaf) continue;
    if (row.isExtraBilantier) continue;
    const first = row.contBase.charAt(0);
    if (first !== "6" && first !== "7") continue;

    const analytic = byCont.get(row.cont);
    const base = byCont.get(row.contBase);
    const current = analytic ?? base ?? null;

    accounts.push({
      cont: row.cont,
      contBase: row.contBase,
      denumire: row.denumire,
      kind: first === "6" ? "expense" : "revenue",
      rulajD: row.rulajD,
      rulajC: row.rulajC,
      currentMapping: current,
      hasAnalyticOverride: analytic !== undefined,
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
  };
}
