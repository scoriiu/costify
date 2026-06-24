/**
 * GET /api/line-trends?clientId=…&year=…&month=…&window=…&metric=…
 *
 * Per-month trend series for the Mapari charts: linii de cost (axa A) and
 * linii de business (axa B). Computed by loadLineTrends from a single journal
 * read; no cache yet (ADR-0004: profile first, cache last). `year`/`month`
 * default to the latest period with journal data, matching the Mapari tab.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getAvailablePeriods } from "@/modules/balances";
import { loadLineTrends } from "@/modules/reporting/owner";
import type { BusinessLineMetric } from "@/modules/reporting/owner";

const BUSINESS_METRICS: readonly BusinessLineMetric[] = [
  "revenue",
  "expenses",
  "profit",
];

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
  const monthRaw = url.searchParams.get("month");
  const monthNum = monthRaw ? parseInt(monthRaw, 10) : NaN;

  let year = Number.isFinite(yearNum) ? yearNum : undefined;
  let month =
    Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12
      ? monthNum
      : undefined;

  if (year === undefined || month === undefined) {
    const periods = await getAvailablePeriods(clientId);
    if (periods.length === 0) {
      return NextResponse.json(
        { error: "Clientul nu are date in jurnal" },
        { status: 404 }
      );
    }
    const latest = periods[periods.length - 1];
    year = latest.year;
    month = latest.month;
  }

  const windowRaw = url.searchParams.get("window");
  const windowNum = windowRaw ? parseInt(windowRaw, 10) : NaN;
  const windowMonths =
    Number.isFinite(windowNum) && windowNum >= 1 && windowNum <= 36
      ? windowNum
      : undefined;

  const metricRaw = url.searchParams.get("metric");
  const businessMetric = BUSINESS_METRICS.includes(
    metricRaw as BusinessLineMetric
  )
    ? (metricRaw as BusinessLineMetric)
    : undefined;

  const data = await loadLineTrends({
    clientId,
    year,
    month,
    windowMonths,
    businessMetric,
  });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
