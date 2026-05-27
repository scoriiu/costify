/**
 * Tests the materialized read-with-fallback contract for ComputedPlan.
 *
 * Mirrors the ComputedPeriod test suite — same invariants apply because
 * the design is the same. Anything that breaks here ships either stale
 * Plan de Conturi data or a missing fallback to live compute.
 *
 *   1. Read returns null when no row exists for (clientId, year, month).
 *   2. Read returns null when the row is stale (dataVersion older than
 *      current). The WHERE clause must filter — never returns and
 *      re-checks in JS.
 *   3. Period-less reads use the sentinel (year=0, month=0). Same row
 *      shape, same correctness model.
 *   4. Write upserts on (clientId, year, month) — never duplicates.
 *   5. Write re-reads dataVersion AT WRITE TIME, not from the caller, to
 *      defend the race where a mutation bumps dataVersion mid-compute.
 *   6. precomputePlans is best-effort: one period's failure doesn't
 *      stop the rest.
 *   7. precomputePlans skips periods where the compute returns null.
 *   8. End-to-end invalidation: a row at v3 is visible at v3,
 *      invisible at v4.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  client: {
    findUnique: vi.fn(),
  },
  computedPlan: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  readComputedPlan,
  writeComputedPlan,
  precomputePlans,
  type ComputedPlanPayload,
} from "@/modules/accounts/computed-plan";

function makePayload(overrides: Partial<ComputedPlanPayload> = {}): ComputedPlanPayload {
  return {
    rows: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readComputedPlan", () => {
  it("returns null when no materialized row exists", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPlan.findFirst.mockResolvedValue(null);

    const result = await readComputedPlan("c1", { year: 2026, month: 4 });
    expect(result).toBeNull();
    expect(prismaMock.computedPlan.findFirst).toHaveBeenCalledWith({
      where: { clientId: "c1", year: 2026, month: 4, dataVersion: 1 },
      select: { rows: true },
    });
  });

  it("uses sentinel year=0, month=0 for period-less reads", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPlan.findFirst.mockResolvedValue(null);

    await readComputedPlan("c1", undefined);

    expect(prismaMock.computedPlan.findFirst).toHaveBeenCalledWith({
      where: { clientId: "c1", year: 0, month: 0, dataVersion: 1 },
      select: { rows: true },
    });
  });

  it("filters by current dataVersion in WHERE — never returns and re-checks in JS", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 9 });
    prismaMock.computedPlan.findFirst.mockResolvedValue(null);

    await readComputedPlan("c1", { year: 2026, month: 4 });

    expect(prismaMock.computedPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dataVersion: 9 }),
      }),
    );
  });

  it("returns the payload when the row matches current version", async () => {
    const rows = [{ cont: "401", name: "Furnizori" } as never];
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 4 });
    prismaMock.computedPlan.findFirst.mockResolvedValue({ rows });

    const result = await readComputedPlan("c1", { year: 2026, month: 4 });
    expect(result).not.toBeNull();
    expect(result?.rows).toBe(rows);
  });
});

describe("writeComputedPlan", () => {
  it("upserts on (clientId, year, month) with current dataVersion", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 5 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    await writeComputedPlan("c1", { year: 2026, month: 4 }, makePayload(), "lazy");

    expect(prismaMock.computedPlan.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.computedPlan.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      clientId_year_month: { clientId: "c1", year: 2026, month: 4 },
    });
    expect(call.create.dataVersion).toBe(5);
    expect(call.update.dataVersion).toBe(5);
  });

  it("upserts the sentinel row for period-less writes", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 5 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    await writeComputedPlan("c1", undefined, makePayload());

    const call = prismaMock.computedPlan.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      clientId_year_month: { clientId: "c1", year: 0, month: 0 },
    });
    expect(call.create.year).toBe(0);
    expect(call.create.month).toBe(0);
  });

  it("re-reads dataVersion at WRITE time", async () => {
    // The caller may have spent seconds computing while a mutation bumped
    // the version. We must stamp the row with the freshest version, not
    // whatever was current when the caller began.
    prismaMock.client.findUnique.mockResolvedValueOnce({ dataVersion: 8 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    await writeComputedPlan("c1", { year: 2026, month: 4 }, makePayload());

    const call = prismaMock.computedPlan.upsert.mock.calls[0][0];
    expect(call.create.dataVersion).toBe(8);
  });

  it("tags rows with computedBy=eager for the import worker", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    await writeComputedPlan("c1", { year: 2026, month: 4 }, makePayload(), "eager");

    const call = prismaMock.computedPlan.upsert.mock.calls[0][0];
    expect(call.create.computedBy).toBe("eager");
  });
});

describe("precomputePlans", () => {
  it("computes and writes a row per period including the period-less base", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    const compute = vi.fn(async () => makePayload());

    const count = await precomputePlans(
      "c1",
      [undefined, { year: 2026, month: 3 }, { year: 2026, month: 4 }],
      compute,
    );

    expect(count).toBe(3);
    expect(compute).toHaveBeenCalledTimes(3);
    expect(prismaMock.computedPlan.upsert).toHaveBeenCalledTimes(3);
  });

  it("isolates per-period failures", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    const compute = vi.fn(async (period) => {
      if (period?.month === 2) throw new Error("boom");
      return makePayload();
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const count = await precomputePlans(
      "c1",
      [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ],
      compute,
    );
    warnSpy.mockRestore();

    expect(count).toBe(2);
    expect(prismaMock.computedPlan.upsert).toHaveBeenCalledTimes(2);
  });

  it("skips periods where compute returns null", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPlan.upsert.mockResolvedValue({});

    const compute = vi.fn(async (period) => (period?.month === 2 ? null : makePayload()));

    const count = await precomputePlans(
      "c1",
      [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ],
      compute,
    );

    expect(count).toBe(2);
  });
});

describe("end-to-end invariant: dataVersion bump invalidates", () => {
  it("a plan row at v4 is invisible after version bumps to v5", async () => {
    prismaMock.client.findUnique.mockResolvedValueOnce({ dataVersion: 4 });
    prismaMock.computedPlan.findFirst.mockResolvedValueOnce({
      rows: [{ cont: "401" } as never],
    });
    const fresh = await readComputedPlan("c1", { year: 2026, month: 4 });
    expect(fresh).not.toBeNull();

    prismaMock.client.findUnique.mockResolvedValueOnce({ dataVersion: 5 });
    prismaMock.computedPlan.findFirst.mockResolvedValueOnce(null);
    const stale = await readComputedPlan("c1", { year: 2026, month: 4 });
    expect(stale).toBeNull();

    expect(prismaMock.computedPlan.findFirst.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ dataVersion: 5 }),
      }),
    );
  });
});
