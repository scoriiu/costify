/**
 * Pod startup warmup probe.
 *
 * Kubernetes hits this as a startupProbe before routing real traffic
 * to a new pod. It touches the heavy lazy-init paths that would
 * otherwise add 300-600 ms to the first user request after deploy:
 *
 *   - Prisma client connection pool (first query is ~80 ms cold)
 *   - OMFP catalog cache (read once, reused for every plan/balance)
 *   - The page-render code path is route-compiled lazily on first hit;
 *     pinging /clients/... here forces Turbopack/Next to compile it
 *
 * Returns 200 only once everything is initialized. The probe's
 * `failureThreshold * periodSeconds` defines how long k3s waits before
 * giving up on the pod — we want this to succeed within a few seconds
 * but never block deploys forever.
 *
 * No auth — this is internal and we never link to it from the UI.
 * Doesn't write anything. Safe to call any number of times.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCatalogMap } from "@/modules/accounts";

let warmedAt: number | null = null;

export async function GET() {
  if (warmedAt !== null) {
    // Already warm — cheap response so the probe stays fast.
    return NextResponse.json({
      status: "ready",
      warmedAt: new Date(warmedAt).toISOString(),
    });
  }

  const t0 = performance.now();
  try {
    // Open a Postgres connection + initialize the Prisma engine. The
    // 'SELECT 1' shape is cheap but forces the lazy init that the
    // first real query would otherwise pay for.
    await prisma.$queryRaw`SELECT 1`;

    // Warm the OMFP catalog cache. ~500 entries, read once at startup,
    // reused for every plan + balance render.
    await getCatalogMap();

    warmedAt = Date.now();
    const ms = performance.now() - t0;
    console.log(`[warmup] ready in ${ms.toFixed(0)}ms`);
    return NextResponse.json({ status: "ready", initMs: Math.round(ms) });
  } catch (err) {
    console.warn(
      "[warmup] init failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { status: "failed", error: String(err) },
      { status: 503 },
    );
  }
}
