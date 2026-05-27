import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getBalanceRowsCached } from "@/modules/cache/loaders";
import { computeKpis, computeCpp, computeCppF20 } from "@/modules/reporting";
import { getCatalogMap } from "@/modules/accounts";
import { getRegimeForPeriod } from "@/modules/clients/tax-regime";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const year = parseInt(url.searchParams.get("year") ?? "");
  const month = parseInt(url.searchParams.get("month") ?? "");

  if (!clientId || isNaN(year) || isNaN(month)) {
    return NextResponse.json({ error: "clientId, year, month obligatorii" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const t0 = Date.now();
  const [balanceResult, catalog, taxRegime] = await Promise.all([
    getBalanceRowsCached(clientId, year, month),
    getCatalogMap(),
    getRegimeForPeriod(clientId, year, month),
  ]);
  const tLoad = Date.now() - t0;

  if (!balanceResult.ok) {
    return NextResponse.json({
      rows: [],
      kpis: null,
      cpp: null,
      cppF20: null,
      taxRegime: null,
    });
  }

  const t1 = Date.now();
  const kpis = computeKpis(balanceResult.data, catalog);
  const tKpi = Date.now() - t1;
  const t2 = Date.now();
  const cpp = computeCpp(balanceResult.data, catalog, { taxRegime });
  const tCpp = Date.now() - t2;
  const t3 = Date.now();
  const cppF20 = computeCppF20(balanceResult.data, catalog, { taxRegime });
  const tF20 = Date.now() - t3;
  console.log(
    `[api/balance] client=${clientId.slice(0, 8)} y=${year} m=${month} rows=${balanceResult.data.length} | load=${tLoad}ms kpi=${tKpi}ms cpp=${tCpp}ms f20=${tF20}ms`,
  );

  return NextResponse.json(
    { rows: balanceResult.data, kpis, cpp, cppF20, taxRegime },
    {
      headers: {
        // The server-side cache (unstable_cache keyed on dataVersion) gives us
        // the speedup. The browser must not cache: response correctness depends
        // on the freshest dataVersion which we read server-side per request.
        "Cache-Control": "no-store",
      },
    }
  );
}
