import { getBalanceRows } from "@/modules/balances";
import type { Result } from "@/shared/errors";
import { ok, err, appError } from "@/shared/errors";
import { computeKpis } from "./kpi";
import { computeCpp } from "./cpp";
import type { KpiSnapshot, CppData } from "./types";

export async function getDatasetKpis(
  datasetId: string,
  year: number,
  month: number
): Promise<Result<KpiSnapshot>> {
  const result = await getBalanceRows({ datasetId, year, month });
  if (!result.ok) return result;

  return ok(computeKpis(result.data));
}

export async function getDatasetCpp(
  datasetId: string,
  year: number,
  month: number
): Promise<Result<CppData>> {
  const result = await getBalanceRows({ datasetId, year, month });
  if (!result.ok) return result;

  const cpp = computeCpp(result.data);
  if (cpp.lines.length === 0) {
    return err(appError("NOT_FOUND", "No P&L data for this period"));
  }

  return ok(cpp);
}
