/**
 * GET /api/mapari-cashflow?clientId=…&year=…&month=…
 *
 * Client-side endpoint for the Mapari Cashflow tab. Returns the full
 * MapariCashflowData payload so the tab can render without a follow-up call.
 * Reads go through `loadMapariCashflowCached`, which is memoized by
 * `Client.dataVersion` — a cache hit is ~5-15 ms, a miss recomputes from
 * the live journal and writes the result back.
 *
 * `year` and `month` are optional. When omitted (or non-numeric), the loader
 * auto-picks the latest year and, within it, the latest month with journal
 * data. The rulaj amounts are YTD-cumulated Jan→month of the chosen year.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { loadMapariCashflowCached } from "@/modules/cache/loaders";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId obligatoriu" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const yearRaw = url.searchParams.get("year");
  const yearNum = yearRaw ? parseInt(yearRaw, 10) : NaN;
  const year = Number.isFinite(yearNum) ? yearNum : undefined;

  const monthRaw = url.searchParams.get("month");
  const monthNum = monthRaw ? parseInt(monthRaw, 10) : NaN;
  const month =
    Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12
      ? monthNum
      : undefined;

  const data = await loadMapariCashflowCached(clientId, { year, month });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
