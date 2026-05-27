/**
 * Per-pod in-memory cache for the resolved PlanRow[] of a client.
 *
 * The Plan response is the heaviest read in the product: a fresh build
 * for UpperHouse takes ~1.5 s and produces ~11k rows / ~3.5 MB JSON.
 * Caching it in pod memory turns repeat fetches from seconds into
 * microseconds; the rest of this module exists to make that cache
 * correct AND safe under concurrent load.
 *
 * Concurrency contract
 *
 *   1. **Single-flight per key.** Two parallel cache misses for the
 *      same `(clientId, dataVersion, year, month)` share a single
 *      compute. Without this, N concurrent users hitting an uncached
 *      client all run the 1.5 s pipeline in parallel — wasting CPU,
 *      saturating Postgres, and risking OOM. We store the in-flight
 *      Promise in an `inflight` Map and every miss after the first
 *      awaits the same Promise.
 *
 *   2. **Versioned keys eliminate coherence problems.** The cache
 *      key includes `dataVersion`, which is bumped on every mutation
 *      that affects the plan. A stale entry is unreachable by
 *      construction — we never need to evict on write, just on memory
 *      pressure. Two pods caching the same client independently is
 *      wasteful but always correct: both see the same version key.
 *
 *   3. **Bytes-aware LRU.** Each entry holds a large array; bounding
 *      by row count, not byte count, lets a few big clients OOM the
 *      pod. We track an approximate size per entry and evict LRU
 *      entries until total bytes drop below `MAX_BYTES`. The estimate
 *      is conservative (`rows.length * 400`) — exact JSON.stringify
 *      would itself be expensive.
 *
 *   4. **Tenant isolation by construction.** Cache keys start with
 *      `clientId`. A read for client A can never see a row written
 *      for client B. The keying is enforced in `keyToString` — never
 *      compute the key from user input outside this module.
 *
 * Failure modes intentionally NOT handled here
 *
 *   - If the underlying compute throws, the inflight Promise rejects
 *     and every awaiter sees the same error. We do NOT cache failures;
 *     the next request will retry from scratch.
 *   - Pod restart clears the cache. The first request after restart
 *     pays the cold-compute cost. This is acceptable — we run 2 pods
 *     for redundancy, not for cache-warming.
 */
import type { PlanRow } from "./plan";

const MAX_BYTES = 400 * 1024 * 1024; // 400 MB per pod
const ROW_BYTES_ESTIMATE = 400; // conservative

interface CacheKey {
  clientId: string;
  dataVersion: number;
  year: number;
  month: number;
}

function keyToString(k: CacheKey): string {
  return `${k.clientId}|${k.dataVersion}|${k.year}|${k.month}`;
}

interface CacheEntry {
  rows: PlanRow[];
  bytes: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PlanRow[]>>();
let totalBytes = 0;

function estimateBytes(rows: PlanRow[]): number {
  return rows.length * ROW_BYTES_ESTIMATE;
}

function evictWhileOverBudget(): void {
  while (totalBytes > MAX_BYTES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    const entry = cache.get(oldestKey)!;
    cache.delete(oldestKey);
    totalBytes -= entry.bytes;
  }
}

/**
 * Read from the cache. Returns null on miss. Touches LRU order so the
 * just-read entry survives the next eviction.
 */
export function readPlanCache(key: CacheKey): PlanRow[] | null {
  const k = keyToString(key);
  const hit = cache.get(k);
  if (!hit) return null;
  // Refresh LRU position so this entry is the youngest.
  cache.delete(k);
  cache.set(k, hit);
  return hit.rows;
}

/**
 * Get-or-load with single-flight. The supplied `loader` runs at most
 * once per key concurrently — every concurrent caller awaits the same
 * Promise. The result is written to the cache on success. On failure
 * the inflight entry is dropped (no negative caching) so the next call
 * retries from scratch.
 */
export async function getOrLoadPlan(
  key: CacheKey,
  loader: () => Promise<PlanRow[]>,
): Promise<PlanRow[]> {
  const hit = readPlanCache(key);
  if (hit) return hit;

  const k = keyToString(key);
  const flying = inflight.get(k);
  if (flying) return flying;

  const promise = (async () => {
    try {
      const rows = await loader();
      writePlanCache(key, rows);
      return rows;
    } finally {
      inflight.delete(k);
    }
  })();
  inflight.set(k, promise);
  return promise;
}

export function writePlanCache(key: CacheKey, rows: PlanRow[]): void {
  const k = keyToString(key);
  const existing = cache.get(k);
  if (existing) totalBytes -= existing.bytes;
  const bytes = estimateBytes(rows);
  cache.set(k, { rows, bytes });
  totalBytes += bytes;
  evictWhileOverBudget();
}

export function planCacheSize(): number {
  return cache.size;
}

export function planCacheBytes(): number {
  return totalBytes;
}

export function planCacheInflight(): number {
  return inflight.size;
}

export function clearPlanCache(): void {
  cache.clear();
  inflight.clear();
  totalBytes = 0;
}
