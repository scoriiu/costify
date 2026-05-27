/**
 * Plan de Conturi read endpoint — paginated + per-pod in-memory cache.
 *
 * The full PlanRow[] for a large client is ~11k rows / 3.5 MB. Two
 * separate optimizations together make this endpoint feel instant:
 *
 *   1. Pagination over the wire — we only ship the offset/limit slice
 *      the UI is about to render (~50 KB). Scroll loads the next page.
 *      Search (`q`) and filters run server-side against the FULL list
 *      so the answer is always complete, never just the first 200.
 *
 *   2. Per-pod in-memory cache for the resolved PlanRow[] keyed on
 *      `(clientId, dataVersion, year, month)`. The first request after
 *      a mutation rebuilds the list (~1.5 s); every subsequent request
 *      slices the cached array (~5 ms). DataVersion in the cache key
 *      guarantees we never return stale rows: when the journal changes,
 *      dataVersion bumps and the prior cache entry becomes unreachable.
 *
 * No Postgres-materialized table, no schema change. The cache lives in
 * the pod's process and warms naturally as traffic arrives.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getClientPlan } from "@/modules/accounts";
import { getClientDataVersion } from "@/modules/clients/data-version";
import { getOrLoadPlan } from "@/modules/accounts/plan-cache";
import type { PlanRow } from "@/modules/accounts/plan";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const NO_PERIOD_SENTINEL = { year: 0, month: 0 };

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const year = parseInt(url.searchParams.get("year") ?? "");
  const month = parseInt(url.searchParams.get("month") ?? "");
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT))),
  );
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const kind = url.searchParams.get("kind") ?? "all"; // all | standard | analytic | review
  const classFilter = url.searchParams.get("class") ?? "all";

  if (!clientId) {
    return NextResponse.json({ error: "clientId obligatoriu" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const period = !isNaN(year) && !isNaN(month) ? { year, month } : undefined;
  const periodKey = period ?? NO_PERIOD_SENTINEL;

  const dataVersion = await getClientDataVersion(clientId);
  const cacheKey = {
    clientId,
    dataVersion,
    year: periodKey.year,
    month: periodKey.month,
  };

  // getOrLoadPlan coalesces concurrent misses: if 5 requests for the
  // same (clientId, version, period) arrive in the same window, the
  // 1.5s compute runs ONCE and the other 4 await its Promise. Without
  // this, a thundering herd on a popular cold client multiplies DB load.
  const t0 = Date.now();
  const all = await getOrLoadPlan(cacheKey, () =>
    getClientPlan(clientId, { period }),
  );
  const tLoad = Date.now() - t0;
  const source: "cache" | "live" = tLoad < 50 ? "cache" : "live";

  const filtered = filterPlan(all, { q, kind, classFilter });
  const items = filtered.slice(offset, offset + limit);
  const reviewCount = all.reduce((n, r) => (r.needsReview ? n + 1 : n), 0);

  console.log(
    `[api/client-accounts] client=${clientId.slice(0, 8)} period=${
      period ? `${period.year}-${period.month}` : "none"
    } offset=${offset} limit=${limit} q=${q ? `"${q}"` : "—"} ` +
      `total=${filtered.length}/${all.length} source=${source} load=${tLoad}ms`,
  );

  return NextResponse.json(
    {
      items,
      total: filtered.length,
      grandTotal: all.length,
      reviewCount,
      offset,
      limit,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

interface PlanFilter {
  q: string;
  kind: string;
  classFilter: string;
}

function filterPlan(rows: PlanRow[], f: PlanFilter): PlanRow[] {
  return rows.filter((row) => {
    if (f.kind === "review" && !row.needsReview) return false;
    if (f.kind === "standard" && row.kind !== "standard") return false;
    if (f.kind === "analytic" && row.kind !== "analytic") return false;
    if (f.classFilter !== "all" && String(row.classDigit) !== f.classFilter) {
      return false;
    }
    if (f.q) {
      const hay = `${row.cont} ${row.name}`.toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });
}
