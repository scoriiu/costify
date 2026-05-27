/**
 * Tests the materialized read-with-fallback contract for ComputedPeriod.
 *
 * Critical invariants we lock down here — bugs in any of these silently
 * ship stale financial data to the accountant. They are the whole reason
 * this caching layer is safe.
 *
 *   1. Read returns null when no row exists for (clientId, year, month).
 *   2. Read returns null when row's dataVersion is stale (lower than
 *      Client.dataVersion). The WHERE clause must filter — we never
 *      return a row and then check the version in JS.
 *   3. Read returns the payload when row's dataVersion matches.
 *   4. Write stamps the row with the CURRENT dataVersion (re-read at
 *      write time), not whatever the caller may have computed against.
 *      This defends the race: caller reads version 5, computes for ~1 s,
 *      another mutation bumps to 6, caller writes — we must NOT tag the
 *      write as version 5.
 *   5. Write upserts: a second write for the same (clientId, year, month)
 *      overwrites instead of inserting a duplicate. The unique index in
 *      Prisma enforces this at the DB level; the test asserts the call
 *      shape goes through upsert (not create).
 *   6. precomputePeriods is best-effort: a thrown error on one period
 *      does not stop subsequent periods from writing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  client: {
    findUnique: vi.fn(),
  },
  computedPeriod: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  readComputedPeriod,
  writeComputedPeriod,
  precomputePeriods,
  type ComputedPeriodPayload,
} from "@/modules/balances/computed-period";

function makePayload(
  overrides: Partial<ComputedPeriodPayload> = {},
): ComputedPeriodPayload {
  return {
    rows: [],
    kpis: null,
    cpp: null,
    cppF20: null,
    taxRegime: "profit_standard",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readComputedPeriod", () => {
  it("returns null when no row exists for the period", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPeriod.findFirst.mockResolvedValue(null);

    const result = await readComputedPeriod("c1", 2026, 4);

    expect(result).toBeNull();
    expect(prismaMock.computedPeriod.findFirst).toHaveBeenCalledWith({
      where: { clientId: "c1", year: 2026, month: 4, dataVersion: 1 },
      select: { rows: true, kpis: true, cpp: true, cppF20: true, taxRegime: true },
    });
  });

  it("never returns a stale row — the WHERE clause filters by current dataVersion", async () => {
    // Client is at version 5. If a row with version 3 existed in the
    // table, the query must NOT return it. We simulate this by asserting
    // findFirst is called with dataVersion: 5 — Prisma's WHERE will
    // not match a row at version 3.
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 5 });
    prismaMock.computedPeriod.findFirst.mockResolvedValue(null);

    const result = await readComputedPeriod("c1", 2026, 4);

    expect(result).toBeNull();
    expect(prismaMock.computedPeriod.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dataVersion: 5 }),
      }),
    );
  });

  it("returns the materialized payload when the row matches current version", async () => {
    const rows = [{ cont: "5121", denumire: "Casa", finD: 100 } as never];
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 7 });
    prismaMock.computedPeriod.findFirst.mockResolvedValue({
      rows,
      kpis: { cash: 100 },
      cpp: null,
      cppF20: null,
      taxRegime: "profit_micro_1",
    });

    const result = await readComputedPeriod("c1", 2026, 4);

    expect(result).not.toBeNull();
    expect(result?.rows).toBe(rows);
    expect(result?.kpis).toEqual({ cash: 100 });
    expect(result?.taxRegime).toBe("profit_micro_1");
  });
});

describe("writeComputedPeriod", () => {
  it("upserts on (clientId, year, month) with the current dataVersion", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 3 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    const payload = makePayload({ taxRegime: "profit_standard" });
    await writeComputedPeriod("c1", 2026, 4, payload, "lazy");

    expect(prismaMock.computedPeriod.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.computedPeriod.upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      clientId_year_month: { clientId: "c1", year: 2026, month: 4 },
    });
    expect(call.create.dataVersion).toBe(3);
    expect(call.update.dataVersion).toBe(3);
  });

  it("re-reads dataVersion at WRITE time, not from the caller", async () => {
    // The caller may have spent 1s computing. During that time another
    // mutation could have bumped dataVersion. The write must reflect the
    // FRESH version, not whatever was current when the caller started.
    //
    // Simulate: first call to findUnique (during compute) returns 5;
    // second call (at write time) returns 6. The write must use 6.
    prismaMock.client.findUnique.mockResolvedValueOnce({ dataVersion: 6 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    await writeComputedPeriod("c1", 2026, 4, makePayload(), "lazy");

    const call = prismaMock.computedPeriod.upsert.mock.calls[0][0];
    expect(call.create.dataVersion).toBe(6);
  });

  it("tags rows with computedBy=eager when called from the import worker", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    await writeComputedPeriod("c1", 2026, 4, makePayload(), "eager");

    const call = prismaMock.computedPeriod.upsert.mock.calls[0][0];
    expect(call.create.computedBy).toBe("eager");
    expect(call.update.computedBy).toBe("eager");
  });

  it("defaults computedBy=lazy when called from the read-fallback path", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    await writeComputedPeriod("c1", 2026, 4, makePayload());

    const call = prismaMock.computedPeriod.upsert.mock.calls[0][0];
    expect(call.create.computedBy).toBe("lazy");
  });
});

describe("precomputePeriods", () => {
  it("calls the compute function once per period and writes each result", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    const compute = vi.fn(async (year: number, month: number) =>
      makePayload({
        taxRegime: month % 2 === 0 ? "profit_micro_1" : "profit_standard",
      }),
    );

    const count = await precomputePeriods(
      "c1",
      [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ],
      compute,
    );

    expect(count).toBe(3);
    expect(compute).toHaveBeenCalledTimes(3);
    expect(prismaMock.computedPeriod.upsert).toHaveBeenCalledTimes(3);
  });

  it("isolates failures — a thrown error on one period does not stop the rest", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    const compute = vi.fn(async (_year: number, month: number) => {
      if (month === 2) throw new Error("oops");
      return makePayload();
    });

    // Suppress the expected warn log during this test.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const count = await precomputePeriods(
      "c1",
      [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ],
      compute,
    );

    expect(count).toBe(2);
    expect(prismaMock.computedPeriod.upsert).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it("skips periods where the compute function returns null", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ dataVersion: 1 });
    prismaMock.computedPeriod.upsert.mockResolvedValue({});

    const compute = vi.fn(async (_year: number, month: number) =>
      month === 2 ? null : makePayload(),
    );

    const count = await precomputePeriods(
      "c1",
      [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
        { year: 2026, month: 3 },
      ],
      compute,
    );

    expect(count).toBe(2);
    expect(prismaMock.computedPeriod.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("invariant: dataVersion bump makes existing rows unreachable", () => {
  it("a row stamped at version N is invisible after version bumps to N+1", async () => {
    // Step 1: client at v3, row exists at v3 → readable.
    prismaMock.client.findUnique.mockResolvedValueOnce({ dataVersion: 3 });
    prismaMock.computedPeriod.findFirst.mockResolvedValueOnce({
      rows: [{ cont: "5121" } as never],
      kpis: null,
      cpp: null,
      cppF20: null,
      taxRegime: "profit_standard",
    });
    const fresh = await readComputedPeriod("c1", 2026, 4);
    expect(fresh).not.toBeNull();

    // Step 2: client bumped to v4. The row at v3 still physically exists
    // in the DB but the WHERE clause filters it out. Prisma returns null.
    prismaMock.client.findUnique.mockResolvedValueOnce({ dataVersion: 4 });
    prismaMock.computedPeriod.findFirst.mockResolvedValueOnce(null);
    const stale = await readComputedPeriod("c1", 2026, 4);
    expect(stale).toBeNull();

    // The second findFirst must have queried for dataVersion: 4 to make
    // the stale row unreachable.
    expect(prismaMock.computedPeriod.findFirst.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ dataVersion: 4 }),
      }),
    );
  });
});
