/**
 * Showcase snapshot loader for the /internal/firma demo pages.
 *
 * Identity is config-driven, not hardcoded:
 *   - `SHOWCASE_CLIENT_SLUG`   — slug to look up at runtime (portable across
 *     dev / staging / prod, unlike a database ID).
 *   - `SHOWCASE_PERIOD`        — optional `YYYY-MM` (e.g. "2026-04"). When
 *     unset, defaults to the latest period with journal data for that client.
 *
 * If `SHOWCASE_CLIENT_SLUG` is unset or the client is missing, `loadFirma…`
 * returns `null` so callers can render a clean empty state instead of crashing
 * — the page is internal-only so a missing showcase is a config issue, not
 * an outage.
 */

import { prisma } from "@/lib/db";
import { type OwnerSnapshot } from "@/modules/reporting/owner";
import {
  loadOwnerSnapshotCached,
  getBalanceRowsCached,
} from "@/modules/cache/loaders";
import { getCatalogMap } from "@/modules/accounts";
import { getAvailablePeriods } from "@/modules/balances";
import { computeKpis } from "@/modules/reporting";

const RO_MONTHS = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
] as const;

export interface ShowcaseClient {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
  year: number;
  month: number;
  /** Human-readable "Aprilie 2026" for display in headers / hints. */
  periodLabel: string;
}

export interface ShowcaseSnapshot {
  client: ShowcaseClient;
  snapshot: OwnerSnapshot;
  marjaOperationala: number | null;
}

function parsePeriodEnv(raw: string | undefined): { year: number; month: number } | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(raw.trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function formatPeriodLabel(year: number, month: number): string {
  return `${RO_MONTHS[month - 1]} ${year}`;
}

/** Returns showcase config or null when not configured / not found. The
 *  caller is responsible for rendering a clean empty state. */
export async function resolveShowcaseClient(): Promise<ShowcaseClient | null> {
  const slug = process.env.SHOWCASE_CLIENT_SLUG?.trim();
  if (!slug) return null;

  const client = await prisma.client.findFirst({
    where: { slug, active: true },
    select: { id: true, slug: true, name: true, cui: true },
  });
  if (!client) return null;

  const explicit = parsePeriodEnv(process.env.SHOWCASE_PERIOD);
  let year: number | undefined = explicit?.year;
  let month: number | undefined = explicit?.month;

  if (year === undefined || month === undefined) {
    const periods = await getAvailablePeriods(client.id);
    if (periods.length === 0) return null;
    const latest = periods[periods.length - 1];
    year = latest.year;
    month = latest.month;
  }

  return {
    id: client.id,
    slug: client.slug,
    name: client.name,
    cui: client.cui,
    year,
    month,
    periodLabel: formatPeriodLabel(year, month),
  };
}

export async function loadFirmaSnapshot(): Promise<ShowcaseSnapshot | null> {
  const client = await resolveShowcaseClient();
  if (!client) return null;

  const [snapshot, balanceResult, catalog] = await Promise.all([
    loadOwnerSnapshotCached({
      clientId: client.id,
      clientName: client.name,
      clientCui: client.cui,
      clientSlug: client.slug,
      year: client.year,
      month: client.month,
    }),
    getBalanceRowsCached(client.id, client.year, client.month),
    getCatalogMap(),
  ]);

  const marja = balanceResult.ok
    ? computeKpis(balanceResult.data, catalog).marjaOperationala
    : null;

  return { client, snapshot, marjaOperationala: marja };
}
