/**
 * Balance + KPI + CPP + tax-regime read endpoint — three-tier cache.
 *
 * Read path, in order:
 *   1. ComputedPeriod (materialized) — one keyed SELECT, ~20 ms server.
 *      Valid when row's dataVersion matches Client.dataVersion.
 *   2. unstable_cache (in-memory, version-keyed) — kept as a safety net
 *      during ComputedPeriod rollout. Also helpful on fresh pods that
 *      haven't materialized yet.
 *   3. Live compute — fetch journal, run computeBalanceFromJournal +
 *      KPIs + CPP + CPP-F20 + regime. Writes back to ComputedPeriod
 *      so the next read is instant. ~1.5 s.
 *
 * Mutation invalidation: every write that affects derived data bumps
 * Client.dataVersion. Stale ComputedPeriod rows become unreachable
 * by the WHERE-clause version filter, so we never serve incorrect
 * data. We deliberately do NOT delete stale rows on bump — concurrent
 * writers would race and stranger bugs would appear. The next read
 * triggers a fresh recompute and overwrites via upsert.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getBalanceRowsCached } from "@/modules/cache/loaders";
import { buildPeriodPayload } from "@/modules/reporting/period-payload";
import {
  readComputedPeriod,
  writeComputedPeriod,
} from "@/modules/balances/computed-period";

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

  // Tier 1: materialized read. If we have a row whose dataVersion
  // matches the client's current data version, we can return it
  // unconditionally — no compute, no journal fetch.
  const tCacheStart = Date.now();
  const cached = await readComputedPeriod(clientId, year, month);
  const tCache = Date.now() - tCacheStart;
  if (cached) {
    console.log(
      `[api/balance] client=${clientId.slice(0, 8)} y=${year} m=${month} rows=${cached.rows.length} | source=computed cache=${tCache}ms`,
    );
    return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
  }

  // Tier 2 + 3: live compute (still goes through the in-memory
  // unstable_cache for the balance rows themselves). On success we
  // materialize the result so the next read goes through tier 1.
  const t0 = Date.now();
  const payload = await buildPeriodPayload(clientId, year, month, getBalanceRowsCached);
  const tLive = Date.now() - t0;

  if (!payload) {
    return NextResponse.json({
      rows: [],
      kpis: null,
      cpp: null,
      cppF20: null,
      taxRegime: null,
    });
  }

  // Materialize for future reads. We await the write so the next
  // request hits tier 1. Fire-and-forget caused a window where pod B
  // served a request while pod A's lazy write was still in flight —
  // both pods then live-computed the same payload. The ~50 ms cost is
  // worth the cache-hit guarantee.
  try {
    await writeComputedPeriod(clientId, year, month, payload, "lazy");
  } catch (e) {
    console.warn(
      `[api/balance] failed to materialize client=${clientId.slice(0, 8)} y=${year} m=${month}:`,
      e instanceof Error ? e.message : e,
    );
  }

  console.log(
    `[api/balance] client=${clientId.slice(0, 8)} y=${year} m=${month} rows=${payload.rows.length} | source=live cache=${tCache}ms compute=${tLive}ms`,
  );

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
