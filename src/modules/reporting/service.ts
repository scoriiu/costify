import { getBalanceRows } from "@/modules/balances";
import type { Result } from "@/shared/errors";
import { ok, err, appError } from "@/shared/errors";
import { computeKpis } from "./kpi";
import { computeCpp } from "./cpp";
import type { KpiSnapshot, CppData } from "./types";

export async function getClientKpis(
  clientId: string,
  year: number,
  month: number
): Promise<Result<KpiSnapshot>> {
  const result = await getBalanceRows(clientId, year, month);
  if (!result.ok) return result;

  return ok(computeKpis(result.data));
}

export async function getClientCpp(
  clientId: string,
  year: number,
  month: number
): Promise<Result<CppData>> {
  const result = await getBalanceRows(clientId, year, month);
  if (!result.ok) return result;

  const cpp = computeCpp(result.data);
  if (cpp.lines.length === 0) {
    return err(appError("NOT_FOUND", "Nu exista date P&L pentru aceasta perioada"));
  }

  return ok(cpp);
}
