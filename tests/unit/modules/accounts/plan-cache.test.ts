/**
 * Concurrency contract for the Plan de Conturi pod-local cache.
 *
 * These tests exist because Costify runs ~2 pods × many concurrent
 * users. A naive cache (no single-flight, no byte budget, no
 * version-keying) silently degrades under load: thundering-herd
 * computes, OOM kills, cross-tenant rows leaking through reused keys.
 *
 * What every test enforces, in order of "if this breaks production
 * goes down":
 *
 *   1. Single-flight: N concurrent misses for the same key share ONE
 *      compute. The loader function must be observed to run exactly
 *      once even when N awaits race in.
 *
 *   2. Different keys never share a compute. Two clients hitting Plan
 *      simultaneously must each get their own loader call — never
 *      block on each other.
 *
 *   3. dataVersion bump mid-flight is observable. A request that
 *      enters the cache at version 4 and a request that enters at
 *      version 5 must see different loaders, never share results.
 *
 *   4. Tenant isolation is structural: a write for client A is
 *      unreachable for a read on client B even when (version, year,
 *      month) match exactly.
 *
 *   5. Loader failures don't poison the cache: the next call retries
 *      from scratch, and the failing inflight Promise is cleaned up.
 *
 *   6. Bytes-aware eviction kicks in when the configured budget is
 *      exceeded; older entries leave first, the just-read entry is
 *      refreshed to youngest.
 *
 *   7. Stress: 50 concurrent reads across 5 clients run to completion
 *      with each client's loader called exactly once.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOrLoadPlan,
  readPlanCache,
  writePlanCache,
  clearPlanCache,
  planCacheSize,
  planCacheBytes,
  planCacheInflight,
} from "@/modules/accounts/plan-cache";
import type { PlanRow } from "@/modules/accounts/plan";

function makeRows(n: number, prefix = "401"): PlanRow[] {
  return Array.from({ length: n }, (_, i) => ({
    cont: `${prefix}.${String(i).padStart(5, "0")}`,
    contBase: prefix,
    name: `Furnizor ${i}`,
    nameSource: "fallback" as const,
    type: "P" as const,
    classDigit: 4,
    kind: "analytic" as const,
    isInCatalog: true,
    needsReview: false,
    partnerCode: null,
    usage: { firstSeen: null, lastSeen: null, entriesCount: 0 },
    currentSold: null,
  }));
}

function defer<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearPlanCache();
});

describe("single-flight: concurrent misses share one compute", () => {
  it("runs the loader exactly once for 10 concurrent misses on the same key", async () => {
    const key = { clientId: "c1", dataVersion: 1, year: 2026, month: 4 };
    const gate = defer<PlanRow[]>();
    const loader = vi.fn(() => gate.promise);

    const racers = Array.from({ length: 10 }, () => getOrLoadPlan(key, loader));
    expect(planCacheInflight()).toBe(1);
    expect(loader).toHaveBeenCalledTimes(1);

    const expected = makeRows(50);
    gate.resolve(expected);
    const results = await Promise.all(racers);

    for (const r of results) expect(r).toBe(expected);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(planCacheInflight()).toBe(0);
    expect(planCacheSize()).toBe(1);
  });

  it("clears the inflight slot after success so future requests hit cache", async () => {
    const key = { clientId: "c1", dataVersion: 1, year: 2026, month: 4 };
    const loader = vi.fn(async () => makeRows(10));

    await getOrLoadPlan(key, loader);
    expect(planCacheInflight()).toBe(0);

    // Second call must hit the cache, not the loader.
    const cached = await getOrLoadPlan(key, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cached).toHaveLength(10);
  });
});

describe("isolation: different keys never share a compute", () => {
  it("runs separate loaders for two clients in parallel", async () => {
    const k1 = { clientId: "c1", dataVersion: 1, year: 2026, month: 4 };
    const k2 = { clientId: "c2", dataVersion: 1, year: 2026, month: 4 };

    const g1 = defer<PlanRow[]>();
    const g2 = defer<PlanRow[]>();
    const loader1 = vi.fn(() => g1.promise);
    const loader2 = vi.fn(() => g2.promise);

    const p1 = getOrLoadPlan(k1, loader1);
    const p2 = getOrLoadPlan(k2, loader2);
    expect(planCacheInflight()).toBe(2);

    const rows1 = makeRows(5, "401");
    const rows2 = makeRows(5, "411");
    g1.resolve(rows1);
    g2.resolve(rows2);

    expect(await p1).toBe(rows1);
    expect(await p2).toBe(rows2);
    expect(loader1).toHaveBeenCalledTimes(1);
    expect(loader2).toHaveBeenCalledTimes(1);
  });

  it("treats different periods of the same client as different keys", async () => {
    const kA = { clientId: "c1", dataVersion: 1, year: 2026, month: 3 };
    const kB = { clientId: "c1", dataVersion: 1, year: 2026, month: 4 };
    const loader = vi.fn(async () => makeRows(3));

    await Promise.all([getOrLoadPlan(kA, loader), getOrLoadPlan(kB, loader)]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("treats different dataVersions of the same period as different keys", async () => {
    const k1 = { clientId: "c1", dataVersion: 4, year: 2026, month: 4 };
    const k2 = { clientId: "c1", dataVersion: 5, year: 2026, month: 4 };
    const loader = vi.fn(async () => makeRows(3));

    await getOrLoadPlan(k1, loader);
    await getOrLoadPlan(k2, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("tenant isolation: a write under client A is unreachable for client B at the same (version, period)", () => {
    const kA = { clientId: "clientA", dataVersion: 1, year: 2026, month: 4 };
    const kB = { clientId: "clientB", dataVersion: 1, year: 2026, month: 4 };
    writePlanCache(kA, makeRows(7));
    expect(readPlanCache(kA)).toHaveLength(7);
    expect(readPlanCache(kB)).toBeNull();
  });
});

describe("mid-flight version bump produces independent computes", () => {
  it("v4 inflight + v5 request → two separate loaders, no shared result", async () => {
    const kV4 = { clientId: "c1", dataVersion: 4, year: 2026, month: 4 };
    const kV5 = { clientId: "c1", dataVersion: 5, year: 2026, month: 4 };
    const g4 = defer<PlanRow[]>();
    const g5 = defer<PlanRow[]>();
    const loader4 = vi.fn(() => g4.promise);
    const loader5 = vi.fn(() => g5.promise);

    const p4 = getOrLoadPlan(kV4, loader4);
    const p5 = getOrLoadPlan(kV5, loader5);

    const rows4 = makeRows(3, "v4");
    const rows5 = makeRows(3, "v5");
    g4.resolve(rows4);
    g5.resolve(rows5);

    const [r4, r5] = await Promise.all([p4, p5]);
    expect(r4).toBe(rows4);
    expect(r5).toBe(rows5);
    expect(r4).not.toBe(r5);
  });
});

describe("loader failures: no negative caching, no leaked inflight", () => {
  it("rejects all awaiters with the same error and clears inflight", async () => {
    const key = { clientId: "c1", dataVersion: 1, year: 2026, month: 4 };
    const loader = vi.fn(async () => {
      throw new Error("DB down");
    });

    const racers = [
      getOrLoadPlan(key, loader).catch((e) => e as Error),
      getOrLoadPlan(key, loader).catch((e) => e as Error),
      getOrLoadPlan(key, loader).catch((e) => e as Error),
    ];
    const results = await Promise.all(racers);
    for (const r of results) {
      expect(r).toBeInstanceOf(Error);
      expect((r as Error).message).toBe("DB down");
    }
    expect(loader).toHaveBeenCalledTimes(1);
    expect(planCacheInflight()).toBe(0);
    expect(planCacheSize()).toBe(0);
  });

  it("retries on next call after a failure", async () => {
    const key = { clientId: "c1", dataVersion: 1, year: 2026, month: 4 };
    let calls = 0;
    const loader = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return makeRows(5);
    });

    await expect(getOrLoadPlan(key, loader)).rejects.toThrow("transient");
    const rows = await getOrLoadPlan(key, loader);
    expect(rows).toHaveLength(5);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe("LRU + bytes-aware eviction", () => {
  it("tracks total bytes and evicts oldest entries when over budget", () => {
    // Synthesize 5 entries each ~100 MB. Budget is 400 MB → oldest gets
    // evicted by the time the 5th lands.
    const rowsBig = makeRows(250_000); // ~100 MB at ROW_BYTES_ESTIMATE=400

    for (let i = 0; i < 5; i++) {
      writePlanCache(
        { clientId: `c${i}`, dataVersion: 1, year: 2026, month: 4 },
        rowsBig,
      );
    }
    expect(planCacheBytes()).toBeLessThanOrEqual(400 * 1024 * 1024);
    // c0 should be the first to leave because LRU order = insertion order
    // when nobody read again.
    expect(
      readPlanCache({ clientId: "c0", dataVersion: 1, year: 2026, month: 4 }),
    ).toBeNull();
    expect(
      readPlanCache({ clientId: "c4", dataVersion: 1, year: 2026, month: 4 }),
    ).not.toBeNull();
  });

  it("refreshes LRU on read: the most recently read entry survives a later eviction", () => {
    const rowsBig = makeRows(250_000);
    for (let i = 0; i < 4; i++) {
      writePlanCache(
        { clientId: `c${i}`, dataVersion: 1, year: 2026, month: 4 },
        rowsBig,
      );
    }
    // Touch c0 so it becomes youngest.
    readPlanCache({ clientId: "c0", dataVersion: 1, year: 2026, month: 4 });
    // Insert a new entry that forces eviction.
    writePlanCache(
      { clientId: "c4", dataVersion: 1, year: 2026, month: 4 },
      rowsBig,
    );
    // c1 (now oldest, since c0 was touched) should be gone, c0 should remain.
    expect(
      readPlanCache({ clientId: "c0", dataVersion: 1, year: 2026, month: 4 }),
    ).not.toBeNull();
    expect(
      readPlanCache({ clientId: "c1", dataVersion: 1, year: 2026, month: 4 }),
    ).toBeNull();
  });
});

describe("stress: 50 concurrent reads across 5 clients", () => {
  it("calls each client's loader exactly once", async () => {
    const clients = ["a", "b", "c", "d", "e"];
    const loaders = new Map(
      clients.map((c) => [c, vi.fn(async () => makeRows(20, c))]),
    );

    // 10 concurrent requests per client, all racing.
    const requests: Promise<PlanRow[]>[] = [];
    for (const c of clients) {
      for (let i = 0; i < 10; i++) {
        const loader = loaders.get(c)!;
        requests.push(
          getOrLoadPlan(
            { clientId: c, dataVersion: 1, year: 2026, month: 4 },
            loader,
          ),
        );
      }
    }
    const results = await Promise.all(requests);

    expect(results).toHaveLength(50);
    for (const c of clients) {
      expect(loaders.get(c)).toHaveBeenCalledTimes(1);
    }
    // Spot-check tenant isolation: every result starts with its own prefix.
    for (let i = 0; i < clients.length; i++) {
      for (let j = 0; j < 10; j++) {
        const r = results[i * 10 + j];
        expect(r[0].cont.startsWith(clients[i])).toBe(true);
      }
    }
  });

  it("never blocks a non-matching key behind a slow loader", async () => {
    const slow = defer<PlanRow[]>();
    const fastDone: boolean[] = [];

    const slowP = getOrLoadPlan(
      { clientId: "slow", dataVersion: 1, year: 2026, month: 4 },
      () => slow.promise,
    );
    // While `slow` is in flight, fire 5 independent fast loaders. None of
    // them should be blocked on `slow`.
    for (let i = 0; i < 5; i++) {
      getOrLoadPlan(
        { clientId: `fast${i}`, dataVersion: 1, year: 2026, month: 4 },
        async () => {
          fastDone.push(true);
          return makeRows(1);
        },
      );
    }
    // Yield the event loop a couple of times to let the fast loaders settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fastDone).toHaveLength(5);
    expect(planCacheInflight()).toBe(1); // only "slow" still in flight

    slow.resolve(makeRows(2));
    await slowP;
  });
});
