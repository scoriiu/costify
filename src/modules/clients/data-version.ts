/**
 * Client data-version: a monotonic per-client counter that gates all caches of
 * derived data (balance, CPP, mapari, owner snapshot, KPIs).
 *
 * The key invariant: every write that changes the value of any computed
 * downstream report MUST call `bumpClientDataVersion(clientId)` in the same
 * transaction (or right after it succeeds). Cached readers key on the version
 * so a cache hit guarantees the cached value matches the on-disk state — no
 * manual invalidation, no tag-juggling, no stale data.
 *
 * Why this design (vs. tag-based revalidation only):
 *   - Tags rely on Next remembering to call `revalidateTag()` after every
 *     write. One forgotten call = silent stale data across thousands of
 *     reads. Detecting that bug is brutal at scale.
 *   - The version is part of the cache key, not metadata. A stale cache
 *     entry is simply unreachable, not "to be evicted". This is
 *     correct-by-construction.
 *   - The version doubles as a poor-man's ETag for client-side polling /
 *     SWR if we ever want it. Reading it is a single cheap SELECT.
 *
 * Performance: the bump is `UPDATE "Client" SET "dataVersion" = "dataVersion"
 * + 1 WHERE id = $1` — a single indexed write, ~1 ms. Cheap enough to call on
 * every relevant write. The version is also returned so callers can echo it
 * back to clients for optimistic UI / verification.
 *
 * Cross-cutting writes — wire this into:
 *   - journal upload (appendJournalEntries)
 *   - historical correction (softDeleteEntriesAfter)
 *   - mapari mapping save/delete (AccountCategoryMapping)
 *   - mapari partner override save/delete (PartnerCategoryOverride)
 *   - vertical allocation save/delete (VerticalAllocation, CategoryVerticalAllocation)
 *   - Client.verticalsEnabled toggle
 *   - JournalPartner rename / override (affects partner-keyed aggregates)
 */

import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Returns the new version. Idempotent in the sense that callers can fire it
 *  freely — over-bumping just causes extra cache misses, never data loss.
 *
 *  No revalidateTag() call is needed: the version IS the cache key suffix, so
 *  a bump makes every stale entry unreachable by construction. This is the
 *  whole point of the version-in-key design — no tags to forget, no race
 *  conditions between write and revalidate. */
export async function bumpClientDataVersion(
  clientId: string,
  client: Pick<PrismaClient, "client"> = prisma
): Promise<number> {
  const updated = await client.client.update({
    where: { id: clientId },
    data: { dataVersion: { increment: 1 } },
    select: { dataVersion: true },
  });
  return updated.dataVersion;
}

/** Read the current version. Used by cache wrappers to construct keys. */
export async function getClientDataVersion(clientId: string): Promise<number> {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: { dataVersion: true },
  });
  return row?.dataVersion ?? 0;
}

/** Stable tag name for cross-loader revalidation if we ever need it. */
export function clientDataVersionTag(clientId: string): string {
  return `client:${clientId}:data`;
}
