/**
 * GET /api/industry-kpis?clientId=…&year=…&month=…
 *
 * Returns the industry-aware KPI section (essentials + industry-specific
 * group) with full formula traces, plus the available periods for the
 * Luna/An selector. Values are cumulative Jan -> selected month.
 *
 * When year/month are omitted, defaults to the latest month with journal
 * data. Balance rows come through the dataVersion-keyed cache; the KPI
 * assembly itself is a pure in-memory computation (<1 ms).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getBalanceRowsCached } from "@/modules/cache/loaders";
import { getAvailablePeriods } from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { computeIndustryKpis, resolveIndustry } from "@/modules/reporting/industry";
import { getEmployeeCount } from "@/modules/clients/employee-counts";
import { prisma } from "@/lib/db";

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

  const [periods, clientFields, catalog] = await Promise.all([
    getAvailablePeriods(clientId),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { industry: true, industrySource: true, caen: true },
    }),
    getCatalogMap(),
  ]);

  if (periods.length === 0) {
    return NextResponse.json(
      { error: "Niciun jurnal incarcat pentru acest client" },
      { status: 404 }
    );
  }

  const yearRaw = parseInt(url.searchParams.get("year") ?? "", 10);
  const monthRaw = parseInt(url.searchParams.get("month") ?? "", 10);
  const latest = periods[periods.length - 1];
  const requested =
    Number.isFinite(yearRaw) && Number.isFinite(monthRaw)
      ? periods.find((p) => p.year === yearRaw && p.month === monthRaw)
      : undefined;
  const period = requested ?? latest;

  const [rowsResult, prevYearResult] = await Promise.all([
    getBalanceRowsCached(clientId, period.year, period.month),
    getBalanceRowsCached(clientId, period.year - 1, period.month),
  ]);

  if (!rowsResult.ok) {
    return NextResponse.json(
      { error: "Nu am putut calcula balanta pentru perioada selectata" },
      { status: 500 }
    );
  }
  const rows = rowsResult.data;
  const prevYearRows = prevYearResult.ok ? prevYearResult.data : [];

  const resolved = resolveIndustry({
    industry: clientFields?.industry ?? null,
    industrySource: clientFields?.industrySource ?? null,
    caen: clientFields?.caen ?? null,
  });

  const numberOfEmployees = await getEmployeeCount(clientId, period.year, period.month);

  const section = computeIndustryKpis(rows, catalog, {
    industry: resolved.id,
    industrySource: resolved.source,
    caen: clientFields?.caen ?? null,
    year: period.year,
    month: period.month,
    prevYearRows,
    numberOfEmployees,
  });

  return NextResponse.json(
    { section, availablePeriods: periods },
    { headers: { "Cache-Control": "no-store" } }
  );
}
