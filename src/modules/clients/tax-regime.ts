/**
 * Service layer for per-client tax regime.
 *
 * The active regime for a given (year, month) is detected from the client's
 * registru jurnal — specifically from which `69x` tax-expense account the
 * accountant booked the impozit on, paired with the corresponding `44xx`
 * tax-debt account. See `tax-regime-detector.ts` for the full algorithm.
 *
 * No manual regime configuration exists; the journal is the source of truth.
 */

import { getSlimEntries } from "@/modules/balances";
import type { TaxRegime } from "@/modules/accounts";
import { detectRegimeForPeriod } from "./tax-regime-detector";
import {
  DEFAULT_TAX_REGIME,
  sortTransitionsAsc,
  type TaxRegimeTransition,
} from "./tax-regime-resolver";

/**
 * Resolve the active regime for (year, month) by reading the client's
 * journal and running the detector. No database state for regime is kept.
 *
 * Uses `getSlimEntries` (5 columns) instead of `getActiveEntries`
 * (15 columns). The detector only ever reads year, contDBase, contCBase
 * and suma — same 5-column slim shape works perfectly, ~2.2× faster fetch.
 */
export async function getRegimeForPeriod(
  clientId: string,
  year: number,
  month: number
): Promise<TaxRegime> {
  const entries = await getSlimEntries(clientId);
  const result = detectRegimeForPeriod(entries, year, month);
  return result.taxRegime;
}

export { sortTransitionsAsc, DEFAULT_TAX_REGIME };
export { taxRegimeLabel, taxRegimeAccount } from "./tax-regime-resolver";
export type { TaxRegimeTransition };
