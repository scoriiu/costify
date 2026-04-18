/**
 * Pure plan-de-conturi view builder.
 *
 * Given the catalog, the client's analytic accounts, journal usage stats,
 * and optional balance rows, produces a unified list of accounts this
 * client has — each annotated with name, type, usage, and current sold.
 *
 * Rendering is the UI's problem. Filtering, searching, and sorting are all
 * computed from this list client-side.
 *
 * See docs/decisions/0001-plan-de-conturi-refactor.md sections 5.1, 5.2.
 */

import { getContBase } from "@/lib/accounts";
import { resolveFromMaps } from "./service";
import type {
  AccountType,
  CatalogAccount,
  ClientAccountRecord,
} from "./types";

export interface PlanRow {
  cont: string;
  contBase: string;
  name: string;
  nameSource: "client_edit" | "client_import" | "omfp_catalog" | "fallback";
  type: AccountType | null;
  classDigit: number | null;
  /** "standard" means the code itself is in AccountCatalog (no dot, ≤4 digits, OMFP list). */
  kind: "standard" | "analytic";
  isInCatalog: boolean;
  /** D14: the contBase is not in AccountCatalog. Rendered as a red indicator in UI. */
  needsReview: boolean;
  partnerCode: string | null;
  usage: {
    firstSeen: Date | null;
    lastSeen: Date | null;
    entriesCount: number;
  };
  currentSold: {
    finD: number;
    finC: number;
  } | null;
}

export interface PlanUsageStats {
  firstSeen: Date;
  lastSeen: Date;
  entriesCount: number;
}

export interface PlanBalanceRow {
  cont: string;
  finD: number;
  finC: number;
}

export interface BuildPlanInput {
  catalog: Map<string, CatalogAccount>;
  clientAccounts: Map<string, ClientAccountRecord>;
  usage: Map<string, PlanUsageStats>;
  balanceRows?: PlanBalanceRow[];
}

export function buildPlan(input: BuildPlanInput): PlanRow[] {
  const { catalog, clientAccounts, usage, balanceRows } = input;

  const balanceMap = new Map<string, PlanBalanceRow>();
  for (const r of balanceRows ?? []) balanceMap.set(r.cont, r);

  // Union of every code we know about for this client:
  //   - explicitly registered in ClientAccount
  //   - seen in any journal entry (from usage stats)
  //   - optionally: present in balance rows
  const knownCodes = new Set<string>();
  for (const code of clientAccounts.keys()) knownCodes.add(code);
  for (const code of usage.keys()) knownCodes.add(code);
  for (const r of balanceRows ?? []) knownCodes.add(r.cont);

  const rows: PlanRow[] = [];
  for (const cont of knownCodes) {
    rows.push(buildRow(cont, input, balanceMap));
  }

  rows.sort((a, b) => a.cont.localeCompare(b.cont, undefined, { numeric: true }));
  return rows;
}

function buildRow(
  cont: string,
  input: BuildPlanInput,
  balanceMap: Map<string, PlanBalanceRow>
): PlanRow {
  const { catalog, clientAccounts, usage } = input;

  const resolved = resolveFromMaps(cont, clientAccounts, catalog);
  const contBase = getContBase(cont);
  const catalogHit = catalog.get(cont);
  const isInCatalog = !!(catalog.get(contBase) || catalogHit);

  // Type + classDigit come from the catalog (directly or via contBase).
  const typeSource = catalogHit ?? catalog.get(contBase) ?? null;
  const type = typeSource?.type ?? null;
  const classDigit =
    typeSource?.classDigit ?? (cont ? parseInt(cont[0], 10) || null : null);

  // "standard" iff the FULL cont is itself in the catalog (no analytic suffix).
  const kind: "standard" | "analytic" = catalogHit ? "standard" : "analytic";

  const clientRecord = clientAccounts.get(cont);
  const needsReview = clientRecord?.needsReview ?? !isInCatalog;
  const partnerCode = clientRecord?.partnerCode ?? null;

  const stats = usage.get(cont) ?? null;

  const bal = balanceMap.get(cont);
  const currentSold = bal ? { finD: bal.finD, finC: bal.finC } : null;

  return {
    cont,
    contBase,
    name: resolved.name,
    nameSource: resolved.source,
    type,
    classDigit: isNaN(classDigit as number) ? null : classDigit,
    kind,
    isInCatalog,
    needsReview,
    partnerCode,
    usage: {
      firstSeen: stats?.firstSeen ?? null,
      lastSeen: stats?.lastSeen ?? null,
      entriesCount: stats?.entriesCount ?? 0,
    },
    currentSold,
  };
}
