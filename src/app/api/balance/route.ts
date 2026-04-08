import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getBalanceRows } from "@/modules/balances";
import { computeKpis, computeCpp } from "@/modules/reporting";

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

  const result = await getBalanceRows(clientId, year, month);
  if (!result.ok) {
    return NextResponse.json({ rows: [], kpis: null, cpp: null });
  }

  const kpis = computeKpis(result.data);
  const cpp = computeCpp(result.data);

  return NextResponse.json({ rows: result.data, kpis, cpp });
}
