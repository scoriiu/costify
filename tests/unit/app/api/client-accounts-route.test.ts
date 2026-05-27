/**
 * Route-level concurrency contract for /api/client-accounts.
 *
 * The pod-local cache (plan-cache.ts) has its own contract tests for
 * single-flight, isolation, eviction. This suite tests the OUTER
 * behaviour of the route handler under the conditions Costify runs in
 * production:
 *
 *   - ~1000 tenants per pod
 *   - many concurrent requests across different tenants
 *   - some requests racing on the same tenant
 *   - mutations bumping dataVersion mid-traffic
 *
 * What we assert:
 *
 *   1. 50 concurrent requests across 5 tenants → getClientPlan() runs
 *      exactly 5 times. No thundering herd.
 *   2. Each tenant sees only its own rows. No cross-tenant leakage even
 *      under heavy concurrency.
 *   3. Auth + tenant access checks run on EVERY request, never skipped
 *      because the result was cached.
 *   4. dataVersion bump invalidates: a fresh request after a bump sees
 *      the new compute, not the cached one.
 *   5. Search (`q`), `kind`, `class` filters run server-side and
 *      reflect the full population, not the paginated slice.
 *   6. The route returns the same JSON shape under load that it does
 *      single-threaded.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PlanRow } from "@/modules/accounts/plan";
import { clearPlanCache } from "@/modules/accounts/plan-cache";

// Every external boundary is mocked. The route logic itself is what we test.
const getSessionUserMock = vi.fn();
const verifyTenantAccessMock = vi.fn();
const getClientPlanMock = vi.fn();
const getClientDataVersionMock = vi.fn();

vi.mock("@/modules/auth/session", () => ({
  getSessionUser: () => getSessionUserMock(),
}));
vi.mock("@/modules/tenant", () => ({
  verifyTenantAccess: (...args: unknown[]) => verifyTenantAccessMock(...args),
}));
vi.mock("@/modules/accounts", () => ({
  getClientPlan: (...args: unknown[]) => getClientPlanMock(...args),
}));
vi.mock("@/modules/clients/data-version", () => ({
  getClientDataVersion: (...args: unknown[]) =>
    getClientDataVersionMock(...args),
}));

// Import AFTER mocks so the route binds to the mocked deps.
import { GET } from "@/app/api/client-accounts/route";

function makeRowsFor(clientId: string, count: number): PlanRow[] {
  return Array.from({ length: count }, (_, i) => ({
    cont: `${clientId}.${String(i).padStart(5, "0")}`,
    contBase: clientId,
    name: `Cont ${clientId} #${i}`,
    nameSource: "fallback" as const,
    type: "A" as const,
    classDigit: 4,
    kind: "analytic" as const,
    isInCatalog: true,
    needsReview: i === 0,
    partnerCode: null,
    usage: { firstSeen: null, lastSeen: null, entriesCount: i },
    currentSold: null,
  }));
}

function makeRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/client-accounts");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

interface RouteJson {
  items: PlanRow[];
  total: number;
  grandTotal: number;
  reviewCount: number;
  offset: number;
  limit: number;
}

async function callRoute(params: Record<string, string>): Promise<RouteJson> {
  const res = await GET(makeRequest(params));
  return (await res.json()) as RouteJson;
}

beforeEach(() => {
  clearPlanCache();
  vi.clearAllMocks();
  getSessionUserMock.mockResolvedValue({ id: "user-1" });
  verifyTenantAccessMock.mockResolvedValue(true);
  getClientDataVersionMock.mockResolvedValue(1);
});

describe("auth + tenant access", () => {
  it("rejects with 401 when no session", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);
    const res = await GET(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(401);
    expect(getClientPlanMock).not.toHaveBeenCalled();
  });

  it("rejects with 400 when clientId missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("rejects with 403 when access denied — never reads the cache", async () => {
    verifyTenantAccessMock.mockResolvedValueOnce(false);
    getClientPlanMock.mockResolvedValue(makeRowsFor("c1", 5));
    const res = await GET(makeRequest({ clientId: "c1" }));
    expect(res.status).toBe(403);
    expect(getClientPlanMock).not.toHaveBeenCalled();
  });

  it("runs auth + tenant checks on EVERY request, even when the plan is cached", async () => {
    getClientPlanMock.mockResolvedValue(makeRowsFor("c1", 5));
    await callRoute({ clientId: "c1" });
    await callRoute({ clientId: "c1" });
    await callRoute({ clientId: "c1" });
    expect(getSessionUserMock).toHaveBeenCalledTimes(3);
    expect(verifyTenantAccessMock).toHaveBeenCalledTimes(3);
    // But the plan is computed once thanks to the cache.
    expect(getClientPlanMock).toHaveBeenCalledTimes(1);
  });
});

describe("thundering herd: 50 concurrent requests across 5 tenants", () => {
  it("computes each tenant's plan exactly once", async () => {
    const tenants = ["a", "b", "c", "d", "e"];
    const plans = new Map(tenants.map((t) => [t, makeRowsFor(t, 30)]));

    getClientPlanMock.mockImplementation(
      async (clientId: string) => plans.get(clientId)!,
    );

    const requests: Promise<RouteJson>[] = [];
    for (const t of tenants) {
      for (let i = 0; i < 10; i++) {
        requests.push(callRoute({ clientId: t, limit: "5" }));
      }
    }
    const results = await Promise.all(requests);

    expect(results).toHaveLength(50);
    expect(getClientPlanMock).toHaveBeenCalledTimes(5);

    // Tenant isolation: every result's items belong to that tenant.
    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      for (let j = 0; j < 10; j++) {
        const json = results[i * 10 + j];
        expect(json.grandTotal).toBe(30);
        for (const row of json.items) {
          expect(row.cont.startsWith(tenant)).toBe(true);
        }
      }
    }
  });
});

describe("dataVersion invalidates per-version cache", () => {
  it("a bump from v1 to v2 triggers a fresh compute", async () => {
    let version = 1;
    getClientDataVersionMock.mockImplementation(async () => version);
    getClientPlanMock.mockResolvedValue(makeRowsFor("c1", 10));

    await callRoute({ clientId: "c1" });
    await callRoute({ clientId: "c1" });
    expect(getClientPlanMock).toHaveBeenCalledTimes(1);

    version = 2;
    await callRoute({ clientId: "c1" });
    expect(getClientPlanMock).toHaveBeenCalledTimes(2);
  });

  it("concurrent requests on different versions of the same client each compute once", async () => {
    const versions = new Map<string, number>([
      ["c1-old", 1],
      ["c1-new", 2],
    ]);
    // Two tagged requests on the same clientId by toggling the mocked version.
    getClientPlanMock.mockImplementation(async () => makeRowsFor("c1", 10));

    getClientDataVersionMock.mockImplementationOnce(async () =>
      versions.get("c1-old")!,
    );
    const p1 = callRoute({ clientId: "c1" });
    getClientDataVersionMock.mockImplementationOnce(async () =>
      versions.get("c1-new")!,
    );
    const p2 = callRoute({ clientId: "c1" });

    await Promise.all([p1, p2]);
    expect(getClientPlanMock).toHaveBeenCalledTimes(2);
  });
});

describe("search + filters run over the full population", () => {
  beforeEach(() => {
    const rows: PlanRow[] = [
      // 5 standard rows in class 4
      ...Array.from({ length: 5 }, (_, i) => ({
        cont: `40${i}`,
        contBase: `40${i}`,
        name: `Furnizor ${i}`,
        nameSource: "omfp_catalog" as const,
        type: "P" as const,
        classDigit: 4,
        kind: "standard" as const,
        isInCatalog: true,
        needsReview: false,
        partnerCode: null,
        usage: { firstSeen: null, lastSeen: null, entriesCount: 0 },
        currentSold: null,
      })),
      // 3 analytic rows in class 6 that mention "TVA"
      ...Array.from({ length: 3 }, (_, i) => ({
        cont: `6.TVA${i}`,
        contBase: "6",
        name: `TVA spesific ${i}`,
        nameSource: "client_edit" as const,
        type: "A" as const,
        classDigit: 6,
        kind: "analytic" as const,
        isInCatalog: false,
        needsReview: i === 0,
        partnerCode: null,
        usage: { firstSeen: null, lastSeen: null, entriesCount: 1 },
        currentSold: null,
      })),
    ];
    getClientPlanMock.mockResolvedValue(rows);
  });

  it("search hits across all rows even when only a slice is returned", async () => {
    const json = await callRoute({ clientId: "c1", q: "TVA", limit: "2" });
    expect(json.grandTotal).toBe(8);
    expect(json.total).toBe(3); // 3 rows match "TVA"
    expect(json.items).toHaveLength(2); // only 2 returned due to limit
    for (const r of json.items) {
      expect(r.name.toLowerCase()).toContain("tva");
    }
  });

  it("kind=standard filters out analytics", async () => {
    const json = await callRoute({ clientId: "c1", kind: "standard" });
    expect(json.total).toBe(5);
    for (const r of json.items) expect(r.kind).toBe("standard");
  });

  it("class=6 filters by classDigit", async () => {
    const json = await callRoute({ clientId: "c1", class: "6" });
    expect(json.total).toBe(3);
    for (const r of json.items) expect(r.classDigit).toBe(6);
  });

  it("kind=review surfaces only needsReview rows", async () => {
    const json = await callRoute({ clientId: "c1", kind: "review" });
    expect(json.total).toBe(1);
    expect(json.items[0].needsReview).toBe(true);
  });

  it("reviewCount reflects the FULL plan even when a filter is active", async () => {
    const json = await callRoute({ clientId: "c1", class: "4" }); // class 4 has 0 review rows
    expect(json.total).toBe(5);
    expect(json.reviewCount).toBe(1); // but full plan still has 1
  });
});

describe("pagination is over the filtered set, not the whole population", () => {
  beforeEach(() => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      cont: String(i).padStart(4, "0"),
      contBase: "5",
      name: `Row ${i}`,
      nameSource: "fallback" as const,
      type: "A" as const,
      classDigit: 5,
      kind: "analytic" as const,
      isInCatalog: true,
      needsReview: false,
      partnerCode: null,
      usage: { firstSeen: null, lastSeen: null, entriesCount: 0 },
      currentSold: null,
    })) as PlanRow[];
    getClientPlanMock.mockResolvedValue(rows);
  });

  it("default page returns first 200 (capped to total)", async () => {
    const json = await callRoute({ clientId: "c1" });
    expect(json.items).toHaveLength(100);
    expect(json.offset).toBe(0);
    expect(json.limit).toBe(200);
    expect(json.grandTotal).toBe(100);
  });

  it("offset slices the response without re-fetching", async () => {
    const a = await callRoute({ clientId: "c1", offset: "0", limit: "10" });
    const b = await callRoute({ clientId: "c1", offset: "10", limit: "10" });
    expect(a.items).toHaveLength(10);
    expect(b.items).toHaveLength(10);
    expect(a.items[0].cont).not.toBe(b.items[0].cont);
    expect(getClientPlanMock).toHaveBeenCalledTimes(1);
  });

  it("clamps limit at 500", async () => {
    const json = await callRoute({ clientId: "c1", limit: "10000" });
    expect(json.limit).toBe(500);
  });
});
