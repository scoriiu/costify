/**
 * Performance regression guard for /clients/<slug> against PRODUCTION.
 *
 * On 2026-05-27 the page took 660 ms cold for UpperHouse (581k journal
 * lines) because getAvailablePeriods used a Prisma findMany+distinct
 * that triggered a parallel seq scan on the JournalLine table. We
 * replaced it with a hand-rolled loose-index-scan recursive CTE and
 * fanned out the client-row's child reads (importEvents, count) into
 * parallel queries. Server-side rendering dropped to ~60 ms.
 *
 * This spec measures the SERVER work end-to-end against the live
 * production deployment (https://costify.ro). The dev server's
 * port-forwarded Postgres adds 50-100 ms per query, so dev-mode
 * measurements aren't representative of what users actually see.
 * The prod path is what matters and what we lock in.
 *
 * Budget rationale:
 *   - Production stage-timing measured 48-65 ms for UpperHouse and
 *     25-32 ms for QHM21 after the loose-index-scan fix.
 *   - Network from the test runner to costify.ro adds TLS handshake
 *     and TCP RTT — once amortized, ~50-100 ms.
 *   - Budget = 250 ms p50, 400 ms p95. If exceeded, the fix is to
 *     find the regression with the stage-timer logs in page.tsx,
 *     not to widen the budget.
 *
 * Skipped when PROD_PERF=0. By default the spec is opt-in via that
 * env var because it depends on a healthy prod deployment that we
 * may not control during CI runs.
 */

import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const PROD_BASE = "https://costify.ro";
const BUDGET_P50_MS = 250;
const BUDGET_P95_MS = 400;
const SAMPLES = 10;

let prisma: PrismaClient;
let sessionToken: string;

// Allow easy opt-out from CI environments that can't reach prod.
const SKIP = process.env.PROD_PERF === "0";

test.beforeAll(async () => {
  if (SKIP) return;
  prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email: "solomon.coriiu@costify.ro" },
    select: { id: true },
  });
  if (!user) throw new Error("Test user not found");
  sessionToken = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 3600_000),
      ipAddress: "127.0.0.1",
      userAgent: "playwright-prod-perf",
    },
  });
});

test.afterAll(async () => {
  if (SKIP) return;
  await prisma.session.deleteMany({ where: { userAgent: "playwright-prod-perf" } });
  await prisma.$disconnect();
});

interface Stats {
  p50: number;
  p95: number;
  min: number;
  max: number;
}

function summarize(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return { p50: p(0.5), p95: p(0.95), min: sorted[0], max: sorted[sorted.length - 1] };
}

async function measureProd(slug: string): Promise<Stats> {
  // One warmup hit to amortize TLS + connection setup on the agent.
  await fetch(`${PROD_BASE}/clients/${slug}?tab=balanta`, {
    headers: { cookie: `sid=${sessionToken}`, "Accept-Encoding": "gzip" },
  });
  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    const res = await fetch(`${PROD_BASE}/clients/${slug}?tab=balanta`, {
      headers: { cookie: `sid=${sessionToken}`, "Accept-Encoding": "gzip" },
    });
    await res.arrayBuffer();
    const ms = performance.now() - t0;
    expect(res.status).toBe(200);
    samples.push(ms);
  }
  return summarize(samples);
}

test.describe("ClientDetailPage — prod render budget", () => {
  test.skip(SKIP, "PROD_PERF=0 — skipping production perf checks");

  test("small client (QHM21) p50 < 250 ms, p95 < 400 ms", async () => {
    const s = await measureProd("qhm21-network-srl");
    console.log(
      `  QHM21 prod: p50=${s.p50.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms min=${s.min.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
    );
    expect(s.p50, "QHM21 p50").toBeLessThan(BUDGET_P50_MS);
    expect(s.p95, "QHM21 p95").toBeLessThan(BUDGET_P95_MS);
  });

  test("big client (UpperHouse) p50 < 250 ms, p95 < 400 ms", async () => {
    const s = await measureProd("upperhouse");
    console.log(
      `  UpperHouse prod: p50=${s.p50.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms min=${s.min.toFixed(0)}ms max=${s.max.toFixed(0)}ms`,
    );
    expect(s.p50, "UpperHouse p50").toBeLessThan(BUDGET_P50_MS);
    expect(s.p95, "UpperHouse p95").toBeLessThan(BUDGET_P95_MS);
  });
});
