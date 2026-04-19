import { getBalanceRows } from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { getRegimeForPeriod } from "@/modules/clients/tax-regime";
import type { Result } from "@/shared/errors";
import { ok, err, appError } from "@/shared/errors";
import { computeKpis } from "./kpi";
import { computeCpp } from "./cpp";
import { computeCppF20 } from "./cpp-f20";
import type { KpiSnapshot, CppData, CppF20Data } from "./types";

export async function getClientKpis(
  clientId: string,
  year: number,
  month: number
): Promise<Result<KpiSnapshot>> {
  const [balanceResult, catalog] = await Promise.all([
    getBalanceRows(clientId, year, month),
    getCatalogMap(),
  ]);
  if (!balanceResult.ok) return balanceResult;

  return ok(computeKpis(balanceResult.data, catalog));
}

export async function getClientCpp(
  clientId: string,
  year: number,
  month: number
): Promise<Result<CppData>> {
  const [balanceResult, catalog, taxRegime] = await Promise.all([
    getBalanceRows(clientId, year, month),
    getCatalogMap(),
    getRegimeForPeriod(clientId, year, month),
  ]);
  if (!balanceResult.ok) return balanceResult;

  const cpp = computeCpp(balanceResult.data, catalog, { taxRegime });
  if (cpp.lines.length === 0) {
    return err(appError("NOT_FOUND", "Nu exista date P&L pentru aceasta perioada"));
  }

  return ok(cpp);
}

export async function getClientCppF20(
  clientId: string,
  year: number,
  month: number
): Promise<Result<CppF20Data>> {
  const [balanceResult, catalog, taxRegime] = await Promise.all([
    getBalanceRows(clientId, year, month),
    getCatalogMap(),
    getRegimeForPeriod(clientId, year, month),
  ]);
  if (!balanceResult.ok) return balanceResult;

  const cppF20 = computeCppF20(balanceResult.data, catalog, { taxRegime });

  return ok(cppF20);
}
