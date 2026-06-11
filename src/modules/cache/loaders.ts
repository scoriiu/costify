/**
 * Cached, version-keyed wrappers around the heavy report loaders.
 *
 * Two layers:
 *   - `cache()` from React: per-request memoization. If the same render
 *     pass calls the wrapper twice with the same args, the body runs once.
 *   - `unstable_cache()` from Next: cross-request memoization, keyed on
 *     `(args..., dataVersion)`. A bump of `Client.dataVersion` shifts the
 *     key for that client → next call is a miss → recomputes → caches.
 *
 * The version is read inside the React-cache layer (one extra cheap SELECT
 * per request) and passed as an explicit arg into the Next-cache layer so
 * it participates in the key. This is the magic that makes the cache
 * correct-by-construction: a stale entry is unreachable, not "to be
 * evicted later". No tag dance, no race conditions, no forgotten
 * invalidations.
 *
 * Performance shape:
 *   - Read dataVersion: ~1 ms (indexed SELECT).
 *   - Cache hit: ~1-5 ms (in-memory lookup, Next).
 *   - Cache miss: full recomputation; result written back into cache.
 *
 * What's NOT here on purpose:
 *   - `computeCpp`, `computeKpis`, `computeCppF20` are pure functions of
 *     balance rows. They don't need their own cache — once balance rows
 *     are cached, downstream computation is fast and deterministic.
 *   - `getCatalogMap` is global-stable (OMFP-1802 chart). It's cached
 *     separately by `@/modules/accounts` and doesn't need re-wrapping.
 *   - `getAvailablePeriods` runs on every page load AND is used by the
 *     period selector — caching it with version-keying would still
 *     require a cache lookup per request. The underlying query is ~10 ms
 *     against an index so we leave it alone.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getBalanceRows as computeBalanceRows } from "@/modules/balances";
import { loadOwnerSnapshot as computeOwnerSnapshot } from "@/modules/reporting/owner";
import { loadMapariCashflow as computeMapariCashflow } from "@/modules/categories";
import {
  getClientDataVersion,
  clientDataVersionTag,
} from "@/modules/clients/data-version";
import type { OwnerSnapshot } from "@/modules/reporting/owner";

/** 24 hours. Version-keying makes correctness independent of TTL, so we
 *  keep entries cheap and let LRU eviction handle pressure. */
const CACHE_REVALIDATE_SECONDS = 24 * 60 * 60;

/* -------------------------------------------------------------------------- */
/*                             getBalanceRowsCached                            */
/* -------------------------------------------------------------------------- */

// TODO(post-computed-period): once `ComputedPeriod` materialization has been
// running in prod without stale-data complaints for ~2 weeks, remove this
// wrapper and call `getBalanceRows` directly. The materialized tier already
// caches the full API response (rows + KPIs + CPP) keyed on dataVersion;
// this in-memory tier only re-caches the row subset and only fires on the
// rare live-compute fallback path.
const cachedBalanceRows = unstable_cache(
  async (
    clientId: string,
    year: number,
    month: number,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    _dataVersion: number
  ) => {
    return computeBalanceRows(clientId, year, month);
  },
  ["balance-rows-v1"],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

/** Drop-in replacement for `getBalanceRows` from @/modules/balances. */
export const getBalanceRowsCached = cache(
  async (clientId: string, year: number, month: number) => {
    const dataVersion = await getClientDataVersion(clientId);
    return cachedBalanceRows(clientId, year, month, dataVersion);
  }
);

/* -------------------------------------------------------------------------- */
/*                            loadOwnerSnapshotCached                          */
/* -------------------------------------------------------------------------- */

interface OwnerSnapshotInput {
  clientId: string;
  clientName: string;
  clientCui: string | null;
  clientSlug: string;
  year: number;
  month: number;
}

const cachedOwnerSnapshot = unstable_cache(
  async (
    clientId: string,
    clientName: string,
    clientCui: string | null,
    clientSlug: string,
    year: number,
    month: number,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    _dataVersion: number
  ): Promise<OwnerSnapshot> => {
    return computeOwnerSnapshot({
      clientId,
      clientName,
      clientCui,
      clientSlug,
      year,
      month,
    });
  },
  // v2: OwnerSnapshot gained industryKpis (industry-aware KPI catalog).
  ["owner-snapshot-v2"],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

export const loadOwnerSnapshotCached = cache(
  async (input: OwnerSnapshotInput): Promise<OwnerSnapshot> => {
    const dataVersion = await getClientDataVersion(input.clientId);
    return cachedOwnerSnapshot(
      input.clientId,
      input.clientName,
      input.clientCui,
      input.clientSlug,
      input.year,
      input.month,
      dataVersion
    );
  }
);

/* -------------------------------------------------------------------------- */
/*                          loadMapariCashflowCached                           */
/* -------------------------------------------------------------------------- */

const cachedMapariCashflow = unstable_cache(
  async (
    clientId: string,
    year: number | undefined,
    month: number | undefined,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    _dataVersion: number
  ) => {
    return computeMapariCashflow(clientId, { year, month });
  },
  ["mapari-cashflow-v2"],
  { revalidate: CACHE_REVALIDATE_SECONDS }
);

export const loadMapariCashflowCached = cache(
  async (clientId: string, opts?: { year?: number; month?: number }) => {
    const dataVersion = await getClientDataVersion(clientId);
    return cachedMapariCashflow(clientId, opts?.year, opts?.month, dataVersion);
  }
);

/* -------------------------------------------------------------------------- */
/*                          Cache tag helpers                                  */
/* -------------------------------------------------------------------------- */

/** Re-export so callers can use it for ad-hoc revalidation without depending
 *  on the data-version module directly. */
export { clientDataVersionTag };
