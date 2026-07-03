/**
 * Single source of truth for the ComputedPeriod payload (rows + KPIs +
 * CPP + CPP-F20 + tax regime).
 *
 * Both writers of ComputedPeriod MUST go through this builder:
 *   - the lazy read path (`/api/balance` tier 3)
 *   - the eager import-worker pre-warm (`ingestion/service.ts`)
 *
 * History lesson: these two paths used to duplicate the computation
 * inline. When the CPP business-line breakdown (vertical context) was
 * added, only the lazy path was updated — a re-import then eagerly
 * materialized CPP snapshots WITHOUT `byVertical`, and every read served
 * the poisoned cache until the next dataVersion bump. Never duplicate
 * this composition again.
 */
import { getBalanceRows } from "@/modules/balances";
import type { BalanceRowView } from "@/modules/balances";
import type { ComputedPeriodPayload } from "@/modules/balances/computed-period";
import { getCatalogMap } from "@/modules/accounts";
import { getRegimeForPeriod } from "@/modules/clients/tax-regime";
import type { Result } from "@/shared/errors";
import { computeKpis } from "./kpi";
import { computeCpp } from "./cpp";
import { computeCppF20 } from "./cpp-f20";
import { loadCppVerticalContext } from "./cpp-vertical-context";

export type FetchBalanceRows = (
  clientId: string,
  year: number,
  month: number,
) => Promise<Result<BalanceRowView[]>>;

/**
 * Compute the full period snapshot. Returns null when balance rows
 * cannot be loaded (callers treat that as "nothing to materialize").
 *
 * `fetchRows` lets the API route inject its unstable_cache-wrapped
 * loader; everyone else uses the plain `getBalanceRows`.
 */
export async function buildPeriodPayload(
  clientId: string,
  year: number,
  month: number,
  fetchRows: FetchBalanceRows = getBalanceRows,
): Promise<ComputedPeriodPayload | null> {
  const [balanceResult, catalog, taxRegime, verticalCtx] = await Promise.all([
    fetchRows(clientId, year, month),
    getCatalogMap(),
    getRegimeForPeriod(clientId, year, month),
    loadCppVerticalContext(clientId, year, month),
  ]);
  if (!balanceResult.ok) return null;

  const vertical = verticalCtx ?? undefined;
  return {
    rows: balanceResult.data,
    kpis: computeKpis(balanceResult.data, catalog),
    cpp: computeCpp(balanceResult.data, catalog, { taxRegime, vertical }),
    cppF20: computeCppF20(balanceResult.data, catalog, { taxRegime, vertical }),
    taxRegime,
  };
}
