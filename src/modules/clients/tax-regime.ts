/**
 * Service layer for per-client tax regime timeline.
 *
 * The active regime for a given (year, month) is resolved from the
 * TaxRegimePeriod timeline. Each row = one transition. For legacy clients
 * with no rows yet, we fall back to Client.taxRegime.
 *
 * Everything here runs server-side (Prisma).
 */

import { prisma } from "@/lib/db";
import type { TaxRegime } from "@/modules/accounts";
import {
  DEFAULT_TAX_REGIME,
  resolveRegimeForPeriod,
  sortTransitionsAsc,
  type TaxRegimeTransition,
} from "./tax-regime-resolver";

export interface TaxRegimePeriodRow {
  id: string;
  startDate: Date;
  taxRegime: TaxRegime;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * Fetch all transitions for a client, sorted ascending by startDate.
 * Never returns undefined — empty array if none exist.
 */
export async function getTransitions(clientId: string): Promise<TaxRegimePeriodRow[]> {
  const rows = await prisma.taxRegimePeriod.findMany({
    where: { clientId },
    orderBy: { startDate: "asc" },
    select: {
      id: true,
      startDate: true,
      taxRegime: true,
      reason: true,
      createdBy: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    startDate: r.startDate,
    taxRegime: r.taxRegime as TaxRegime,
    reason: r.reason,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));
}

/**
 * Resolve the active regime for (year, month).
 *
 * Lookup order:
 *   1. Most recent TaxRegimePeriod with startDate <= last day of month.
 *   2. If none applies, fall back to Client.taxRegime (legacy column).
 *   3. If client is missing, DEFAULT_TAX_REGIME.
 */
export async function getRegimeForPeriod(
  clientId: string,
  year: number,
  month: number
): Promise<TaxRegime> {
  const [transitions, client] = await Promise.all([
    getTransitions(clientId),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { taxRegime: true },
    }),
  ]);

  const fallback = (client?.taxRegime as TaxRegime | undefined) ?? DEFAULT_TAX_REGIME;
  const list: TaxRegimeTransition[] = transitions.map((t) => ({
    startDate: t.startDate,
    taxRegime: t.taxRegime,
    reason: t.reason,
  }));
  return resolveRegimeForPeriod(list, year, month, fallback);
}

/** Same as getRegimeForPeriod but accepts pre-fetched transitions for reuse. */
export function resolveFromTransitions(
  transitions: TaxRegimePeriodRow[],
  year: number,
  month: number,
  fallback: TaxRegime = DEFAULT_TAX_REGIME
): TaxRegime {
  const list: TaxRegimeTransition[] = transitions.map((t) => ({
    startDate: t.startDate,
    taxRegime: t.taxRegime,
    reason: t.reason,
  }));
  return resolveRegimeForPeriod(list, year, month, fallback);
}

/**
 * Create a new transition. The startDate must be unique per client
 * (enforced by DB unique index). Two transitions on the same day
 * would be ambiguous.
 */
export async function createTransition(input: {
  clientId: string;
  startDate: Date;
  taxRegime: TaxRegime;
  reason?: string | null;
  createdBy: string;
}): Promise<TaxRegimePeriodRow> {
  const row = await prisma.taxRegimePeriod.create({
    data: {
      clientId: input.clientId,
      startDate: input.startDate,
      taxRegime: input.taxRegime,
      reason: input.reason ?? null,
      createdBy: input.createdBy,
    },
    select: {
      id: true,
      startDate: true,
      taxRegime: true,
      reason: true,
      createdBy: true,
      createdAt: true,
    },
  });
  return {
    id: row.id,
    startDate: row.startDate,
    taxRegime: row.taxRegime as TaxRegime,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function updateTransition(
  clientId: string,
  transitionId: string,
  patch: {
    startDate?: Date;
    taxRegime?: TaxRegime;
    reason?: string | null;
  }
): Promise<TaxRegimePeriodRow | null> {
  const existing = await prisma.taxRegimePeriod.findFirst({
    where: { id: transitionId, clientId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.taxRegimePeriod.update({
    where: { id: transitionId },
    data: {
      ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
      ...(patch.taxRegime !== undefined ? { taxRegime: patch.taxRegime } : {}),
      ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
    },
    select: {
      id: true,
      startDate: true,
      taxRegime: true,
      reason: true,
      createdBy: true,
      createdAt: true,
    },
  });
  return {
    id: row.id,
    startDate: row.startDate,
    taxRegime: row.taxRegime as TaxRegime,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export async function deleteTransition(
  clientId: string,
  transitionId: string
): Promise<boolean> {
  const existing = await prisma.taxRegimePeriod.findFirst({
    where: { id: transitionId, clientId },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.taxRegimePeriod.delete({ where: { id: transitionId } });
  return true;
}

/**
 * One-time migration helper: for every existing Client that has taxRegime set
 * but NO TaxRegimePeriod rows, seed a synthetic "inception" transition dated
 * 1970-01-01 so the resolver always finds a match.
 *
 * Safe to run multiple times (idempotent — only clients with zero periods get seeded).
 */
export async function seedInceptionTransitionsForLegacyClients(): Promise<number> {
  const clientsWithoutTimeline = await prisma.client.findMany({
    where: {
      taxRegimePeriods: { none: {} },
    },
    select: { id: true, taxRegime: true },
  });

  if (clientsWithoutTimeline.length === 0) return 0;

  await prisma.taxRegimePeriod.createMany({
    data: clientsWithoutTimeline.map((c) => ({
      clientId: c.id,
      startDate: new Date("1970-01-01"),
      taxRegime: c.taxRegime,
      reason: null,
      createdBy: null,
    })),
    skipDuplicates: true,
  });

  return clientsWithoutTimeline.length;
}

export { sortTransitionsAsc };
export { taxRegimeLabel, taxRegimeAccount, DEFAULT_TAX_REGIME } from "./tax-regime-resolver";
export type { TaxRegimeTransition } from "./tax-regime-resolver";
