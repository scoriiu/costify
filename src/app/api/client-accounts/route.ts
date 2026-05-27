/**
 * Plan de Conturi read endpoint — two-tier cache.
 *
 * tier 1: ComputedPlan (materialized) — one keyed SELECT, ~30 ms server.
 *         Valid when row's dataVersion matches Client.dataVersion.
 * tier 2: live compute via getClientPlan — fetches catalog + client
 *         accounts + partner names + usage stats + balance, then merges.
 *         Writes back to ComputedPlan so the next read is instant.
 *
 * Mutation invalidation: every write that affects derived data bumps
 * Client.dataVersion. Stale ComputedPlan rows become unreachable by
 * the version filter on the WHERE clause. Never delete on bump.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { getClientPlan } from "@/modules/accounts";
import {
  readComputedPlan,
  writeComputedPlan,
} from "@/modules/accounts/computed-plan";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const year = parseInt(url.searchParams.get("year") ?? "");
  const month = parseInt(url.searchParams.get("month") ?? "");

  if (!clientId) {
    return NextResponse.json({ error: "clientId obligatoriu" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const period = !isNaN(year) && !isNaN(month) ? { year, month } : undefined;

  // Tier 1: materialized read.
  const tCacheStart = Date.now();
  const cached = await readComputedPlan(clientId, period);
  const tCache = Date.now() - tCacheStart;
  if (cached) {
    console.log(
      `[api/client-accounts] client=${clientId.slice(0, 8)} period=${period ? `${period.year}-${period.month}` : "none"} rows=${cached.rows.length} | source=computed cache=${tCache}ms`,
    );
    return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
  }

  // Tier 2: live compute + write-back. We don't block the response on the
  // write — a failure here is a perf regression, not a correctness bug
  // (the next read will just go through the same path again).
  const t0 = Date.now();
  const rows = await getClientPlan(clientId, { period });
  const tLive = Date.now() - t0;
  writeComputedPlan(clientId, period, { rows }, "lazy").catch((e) => {
    console.warn(
      `[api/client-accounts] failed to materialize client=${clientId.slice(0, 8)}:`,
      e instanceof Error ? e.message : e,
    );
  });
  console.log(
    `[api/client-accounts] client=${clientId.slice(0, 8)} period=${period ? `${period.year}-${period.month}` : "none"} rows=${rows.length} | source=live cache=${tCache}ms live=${tLive}ms`,
  );

  return NextResponse.json({ rows }, {
    headers: { "Cache-Control": "no-store" },
  });
}
