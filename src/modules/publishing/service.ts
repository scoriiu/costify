/**
 * Publishing service — controls what an OWNER can see on /firma.
 *
 * Performance design (target: 150k clients, 10M rows, ~5k publish/hour at peak):
 *
 *  - Snapshot is computed at publish time. The OWNER view reads that frozen
 *    snapshot, NOT a live recompute. Protects the patron from in-flight edits.
 *  - "Stale" is a stored column (`staleSince`), not a query. Set by the
 *    ingestion + journal modules when they touch a published period. Cleared
 *    by publish. O(1) read.
 *  - Trends reuse: when publishing month M, the 12 trend points for months
 *    M-1..M-12 are read from existing PublishedPeriod snapshots if available,
 *    fallback to live compute only for months that have never been published.
 *    Drops a publish from ~13 balance computes down to 1 in the common case.
 *  - `snapshotHash` (SHA-256) is stored so audit events keep only the hash +
 *    KPI digest instead of the full 5-10KB JSON.
 *
 * This service is pure-data and audit-free. Audit is the caller's job
 * (server actions), keeping the service easy to test in isolation.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { loadOwnerSnapshot } from "@/modules/reporting/owner";
import type { OwnerSnapshot, MonthlyTrendPoint } from "@/modules/reporting/owner";
import {
  SNAPSHOT_VERSION,
  type PublishedPeriodSummary,
  type PublishedPeriodView,
  type PublishPeriodInput,
  type UnpublishPeriodInput,
} from "./types";
import { computeSnapshotHash } from "./snapshot-hash";

interface ClientForSnapshot {
  id: string;
  name: string;
  cui: string | null;
  slug: string;
}

async function loadClientForSnapshot(clientId: string): Promise<ClientForSnapshot> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, cui: true, slug: true, active: true },
  });
  if (!client || !client.active) {
    throw new Error("Clientul nu exista sau este inactiv");
  }
  return { id: client.id, name: client.name, cui: client.cui, slug: client.slug };
}

function assertValidPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error(`An invalid: ${year}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Luna invalida: ${month}`);
  }
}

function priorPeriods(year: number, month: number, count: number) {
  const result: Array<{ year: number; month: number }> = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    result.push({ year: y, month: m });
  }
  return result;
}

/**
 * For the 12 months before (year, month), replace any trend point with the
 * value from a previously published snapshot if one exists. Months without a
 * publication keep the live-computed value the loader produced.
 */
async function reuseTrendsFromPublished(
  clientId: string,
  year: number,
  month: number,
  liveTrends: MonthlyTrendPoint[]
): Promise<MonthlyTrendPoint[]> {
  const prior = priorPeriods(year, month, 12);
  const publishedPrior = await prisma.publishedPeriod.findMany({
    where: {
      clientId,
      OR: prior.map((p) => ({ year: p.year, month: p.month })),
    },
    select: { year: true, month: true, snapshotData: true },
  });

  const cache = new Map<string, MonthlyTrendPoint>();
  for (const row of publishedPrior) {
    const snap = row.snapshotData as unknown as OwnerSnapshot;
    if (!snap?.summary) continue;
    const trendForThatMonth = snap.trends?.find(
      (t) => t.year === row.year && t.month === row.month
    );
    if (trendForThatMonth) {
      cache.set(`${row.year}-${row.month}`, trendForThatMonth);
    }
  }

  return liveTrends.map((point) => {
    const reused = cache.get(`${point.year}-${point.month}`);
    return reused ?? point;
  });
}

/**
 * Publish (or re-publish) one period for one client.
 *
 *  - Computes the snapshot live from the current journal.
 *  - Reuses trend points from already-published prior months.
 *  - Upserts the PublishedPeriod row with hash + clears staleSince.
 */
export async function publishPeriod(
  input: PublishPeriodInput
): Promise<PublishedPeriodSummary> {
  assertValidPeriod(input.year, input.month);

  const client = await loadClientForSnapshot(input.clientId);

  const liveSnapshot = await loadOwnerSnapshot({
    clientId: client.id,
    clientName: client.name,
    clientCui: client.cui,
    clientSlug: client.slug,
    year: input.year,
    month: input.month,
  });

  const trends = await reuseTrendsFromPublished(
    client.id,
    input.year,
    input.month,
    liveSnapshot.trends
  );
  const snapshot: OwnerSnapshot = { ...liveSnapshot, trends };
  const snapshotHash = computeSnapshotHash(snapshot);

  const now = new Date();

  const row = await prisma.publishedPeriod.upsert({
    where: {
      clientId_year_month: {
        clientId: input.clientId,
        year: input.year,
        month: input.month,
      },
    },
    create: {
      clientId: input.clientId,
      year: input.year,
      month: input.month,
      publishedBy: input.publishedBy,
      publishedAt: now,
      noteForOwner: input.noteForOwner ?? null,
      snapshotVersion: SNAPSHOT_VERSION,
      snapshotData: snapshot as unknown as Prisma.InputJsonValue,
      snapshotHash,
      staleSince: null,
    },
    update: {
      publishedBy: input.publishedBy,
      publishedAt: now,
      noteForOwner: input.noteForOwner ?? null,
      snapshotVersion: SNAPSHOT_VERSION,
      snapshotData: snapshot as unknown as Prisma.InputJsonValue,
      snapshotHash,
      staleSince: null,
    },
    include: { publisher: { select: { name: true } } },
  });

  return {
    id: row.id,
    clientId: row.clientId,
    year: row.year,
    month: row.month,
    publishedBy: row.publishedBy,
    publisherName: row.publisher?.name ?? null,
    publishedAt: row.publishedAt,
    noteForOwner: row.noteForOwner,
    snapshotVersion: row.snapshotVersion,
    snapshotHash: row.snapshotHash,
    stale: false,
  };
}

export async function unpublishPeriod(input: UnpublishPeriodInput): Promise<boolean> {
  assertValidPeriod(input.year, input.month);
  const result = await prisma.publishedPeriod.deleteMany({
    where: { clientId: input.clientId, year: input.year, month: input.month },
  });
  return result.count > 0;
}

export async function getLatestPublishedPeriod(
  clientId: string
): Promise<PublishedPeriodSummary | null> {
  const row = await prisma.publishedPeriod.findFirst({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { publisher: { select: { name: true } } },
  });
  return row ? toSummary(row) : null;
}

export async function getLatestPublishedView(
  clientId: string
): Promise<PublishedPeriodView | null> {
  const row = await prisma.publishedPeriod.findFirst({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { publisher: { select: { name: true } } },
  });
  return row ? toView(row) : null;
}

export async function getPublishedView(
  clientId: string,
  year: number,
  month: number
): Promise<PublishedPeriodView | null> {
  assertValidPeriod(year, month);
  const row = await prisma.publishedPeriod.findUnique({
    where: { clientId_year_month: { clientId, year, month } },
    include: { publisher: { select: { name: true } } },
  });
  return row ? toView(row) : null;
}

export async function listPublishedPeriods(
  clientId: string
): Promise<PublishedPeriodSummary[]> {
  const rows = await prisma.publishedPeriod.findMany({
    where: { clientId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { publisher: { select: { name: true } } },
  });
  return rows.map(toSummary);
}

/**
 * Called by ingestion + journal services whenever data for (clientId, year, month)
 * is added, restored, or soft-deleted. Sets staleSince only if it is currently
 * null (so we don't overwrite an existing stale timestamp).
 *
 * Idempotent; runs as a single UPDATE statement.
 */
export async function markPeriodsAsStale(
  clientId: string,
  periods: Array<{ year: number; month: number }>
): Promise<void> {
  if (periods.length === 0) return;
  await prisma.publishedPeriod.updateMany({
    where: {
      clientId,
      staleSince: null,
      OR: periods.map((p) => ({ year: p.year, month: p.month })),
    },
    data: { staleSince: new Date() },
  });
}

type RowWithPublisher = {
  id: string;
  clientId: string;
  year: number;
  month: number;
  publishedBy: string;
  publishedAt: Date;
  noteForOwner: string | null;
  snapshotVersion: number;
  snapshotData: Prisma.JsonValue;
  snapshotHash: string;
  staleSince: Date | null;
  publisher?: { name: string } | null;
};

function toSummary(row: RowWithPublisher): PublishedPeriodSummary {
  return {
    id: row.id,
    clientId: row.clientId,
    year: row.year,
    month: row.month,
    publishedBy: row.publishedBy,
    publisherName: row.publisher?.name ?? null,
    publishedAt: row.publishedAt,
    noteForOwner: row.noteForOwner,
    snapshotVersion: row.snapshotVersion,
    snapshotHash: row.snapshotHash,
    stale: row.staleSince !== null,
  };
}

function toView(row: RowWithPublisher): PublishedPeriodView {
  return {
    ...toSummary(row),
    snapshot: upgradeSnapshot(row.snapshotData as unknown as OwnerSnapshot),
  };
}

/**
 * Backwards-compatibility shim for snapshots persisted before SNAPSHOT_VERSION=2.
 * Older payloads lack expenseBreakdown / revenueBreakdown / topMonthlyExpenses /
 * runway / salaryAffordability / yoy — we fill them with empty defaults so the
 * UI renders gracefully instead of throwing. Republishing the period restores
 * the real values.
 */
function upgradeSnapshot(snap: OwnerSnapshot): OwnerSnapshot {
  const s = snap as Partial<OwnerSnapshot>;
  return {
    ...snap,
    expenseBreakdown: s.expenseBreakdown ?? [],
    revenueBreakdown: s.revenueBreakdown ?? [],
    topMonthlyExpenses: s.topMonthlyExpenses ?? [],
    runway: s.runway ?? {
      cashAvailable: 0,
      monthlyBurnRate: 0,
      monthsRemaining: 0,
      windowMonths: 3,
      status: "unknown",
    },
    salaryAffordability: s.salaryAffordability ?? {
      monthlyPayroll: 0,
      cashAvailable: 0,
      monthsCovered: 0,
      status: "no_payroll",
    },
    yoy: s.yoy ?? {
      revenue: { current: 0, previous: 0, delta: 0, deltaPct: null },
      expenses: { current: 0, previous: 0, delta: 0, deltaPct: null },
      profit: { current: 0, previous: 0, delta: 0, deltaPct: null },
      cashEnd: { current: 0, previous: 0, delta: 0, deltaPct: null },
      hasPreviousYear: false,
    },
    verticalBreakdown: s.verticalBreakdown ?? [],
    // Sprint 7 added dataQuality. Published snapshots from before this
    // shipped don't have it; fall back to a hidden-badge state so the
    // antreprenor's published view stays valid.
    dataQuality: s.dataQuality ?? {
      coveragePercent: 0,
      partnerOverrideCount: 0,
      hasAnyReview: false,
    },
    // Spec-unificat additions (verdict/kpiStrip/cashflowBreakdown/obligations/
    // healthScore/ratios/patrimoniu/topActivity). Old snapshots predate these;
    // a re-publish restores real values, but until then we render benign
    // defaults so the dashboard stays functional.
    verdict: s.verdict ?? {
      tone: "neutral",
      headline: "Date publicate inainte de noua versiune",
      body:
        "Aceasta luna a fost publicata inainte ca verdictul automat sa fie disponibil. Re-publica luna pentru text actualizat.",
      highlights: [],
    },
    kpiStrip: s.kpiStrip ?? [],
    cashflowBreakdown: s.cashflowBreakdown ?? {
      cashStart: 0,
      cashEnd: 0,
      netChange: 0,
      operating: 0,
      investing: 0,
      financing: 0,
      operatingDetail: [],
      investingDetail: [],
      financingDetail: [],
    },
    obligations: s.obligations ?? [],
    healthScore: s.healthScore ?? {
      score: 0,
      tier: "watch",
      tierLabel: "Indisponibil",
      message:
        "Scorul nu a fost calculat la momentul publicarii. Re-publica luna pentru valori actualizate.",
      subscores: [],
    },
    ratios: s.ratios ?? [],
    patrimoniu: s.patrimoniu ?? {
      asOfYear: snap.meta?.year ?? 0,
      asOfMonth: snap.meta?.month ?? 0,
      activ: [],
      pasiv: [],
      totalActiv: 0,
      totalPasiv: 0,
      difference: 0,
      isBalanced: true,
    },
    topCustomersByActivity: s.topCustomersByActivity ?? [],
    topSuppliersByActivity: s.topSuppliersByActivity ?? [],
  };
}
