import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getBalanceRows } from "@/modules/balances";
import { computeKpis, computeCpp, computeCppF20 } from "@/modules/reporting";
import { getCatalogMap } from "@/modules/accounts";
import type { TaxRegime } from "@/modules/accounts";

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

  const [balanceResult, catalog, client] = await Promise.all([
    getBalanceRows(clientId, year, month),
    getCatalogMap(),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { taxRegime: true },
    }),
  ]);

  if (!balanceResult.ok) {
    return NextResponse.json({
      rows: [],
      kpis: null,
      cpp: null,
      cppF20: null,
      taxRegime: null,
    });
  }

  const taxRegime = (client?.taxRegime as TaxRegime | undefined) ?? "profit_standard";
  const kpis = computeKpis(balanceResult.data, catalog);
  const cpp = computeCpp(balanceResult.data, catalog, { taxRegime });
  const cppF20 = computeCppF20(balanceResult.data, catalog, { taxRegime });

  return NextResponse.json(
    { rows: balanceResult.data, kpis, cpp, cppF20, taxRegime },
    { headers: { "Cache-Control": "no-store" } }
  );
}
