/**
 * Showcase snapshot loader.
 *
 * Thin wrapper over the production loadOwnerSnapshot, with QHM21 NETWORK SRL
 * hardcoded as the client and April 2026 as the period. This is the single
 * place where "which client + which period" lives for the entire /internal/firma
 * showcase.
 */

import { loadOwnerSnapshot, type OwnerSnapshot } from "@/modules/reporting/owner";
import { getBalanceRows } from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { computeKpis } from "@/modules/reporting";

export const QHM_CLIENT_ID = "cmnq1d8z40003mh369thebaw6";
export const QHM_SLUG = "qhm21-network-srl";
export const QHM_NAME = "QHM21 NETWORK SRL";
export const QHM_CUI = "RO31679778";
export const SNAPSHOT_YEAR = 2026;
export const SNAPSHOT_MONTH = 4;
export const SNAPSHOT_LABEL = "Aprilie 2026";

export const INTERNAL_WHITELIST = [
  "solomon.coriiu@costify.ro",
  "claudia.solomon@costify.ro",
  "sorin.crisan@costify.ro",
];

export interface ShowcaseSnapshot {
  snapshot: OwnerSnapshot;
  marjaOperationala: number | null;
}

export async function loadFirmaSnapshot(): Promise<ShowcaseSnapshot> {
  const [snapshot, balanceResult, catalog] = await Promise.all([
    loadOwnerSnapshot({
      clientId: QHM_CLIENT_ID,
      clientName: QHM_NAME,
      clientCui: QHM_CUI,
      clientSlug: QHM_SLUG,
      year: SNAPSHOT_YEAR,
      month: SNAPSHOT_MONTH,
    }),
    getBalanceRows(QHM_CLIENT_ID, SNAPSHOT_YEAR, SNAPSHOT_MONTH),
    getCatalogMap(),
  ]);

  const marja =
    balanceResult.ok
      ? computeKpis(balanceResult.data, catalog).marjaOperationala
      : null;

  return { snapshot, marjaOperationala: marja };
}
