import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OwnerSnapshot } from "@/modules/reporting/owner";

const prismaMock = vi.hoisted(() => ({
  client: {
    findUnique: vi.fn(),
  },
  publishedPeriod: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const loadOwnerSnapshotMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/reporting/owner", () => ({
  loadOwnerSnapshot: loadOwnerSnapshotMock,
}));

import {
  publishPeriod,
  unpublishPeriod,
  getLatestPublishedPeriod,
  getLatestPublishedView,
  getPublishedView,
  listPublishedPeriods,
  markPeriodsAsStale,
} from "@/modules/publishing/service";

function makeSnapshot(overrides: Partial<OwnerSnapshot> = {}): OwnerSnapshot {
  return {
    meta: {
      clientId: "client-1",
      name: "QHM21 NETWORK SRL",
      cui: "RO31679778",
      slug: "qhm21-network-srl",
      year: 2026,
      month: 4,
      periodLabel: "Aprilie 2026",
    },
    summary: {
      cifraAfaceriLuna: 100000,
      cifraAfaceriYTD: 400000,
      cheltuieliLuna: 60000,
      cheltuieliYTD: 240000,
      soldRegistruCasa: 5000,
      soldConturiBancare: 50000,
      clientiNeincasati: 30000,
      furnizoriNeachitati: 12000,
    } as never,
    cashPosition: {} as never,
    ownerWithdrawals: { items: [], total: 0 } as never,
    trends: [],
    insights: [],
    outstanding: {} as never,
    ...overrides,
  } as OwnerSnapshot;
}

function makeActiveClient(id = "client-1") {
  return {
    id,
    name: "QHM21 NETWORK SRL",
    cui: "RO31679778",
    slug: "qhm21-network-srl",
    active: true,
  };
}

function makePublishedRow(opts: {
  id?: string;
  clientId?: string;
  year: number;
  month: number;
  publishedAt?: Date;
  publishedBy?: string;
  publisherName?: string;
  noteForOwner?: string | null;
  staleSince?: Date | null;
  snapshot?: OwnerSnapshot;
  snapshotHash?: string;
}) {
  return {
    id: opts.id ?? "pp-1",
    clientId: opts.clientId ?? "client-1",
    year: opts.year,
    month: opts.month,
    publishedBy: opts.publishedBy ?? "accountant-1",
    publishedAt: opts.publishedAt ?? new Date("2026-04-18T10:00:00.000Z"),
    noteForOwner: opts.noteForOwner ?? null,
    snapshotVersion: 1,
    snapshotData: opts.snapshot ?? makeSnapshot(),
    snapshotHash: opts.snapshotHash ?? "deadbeef",
    staleSince: opts.staleSince ?? null,
    publisher: { name: opts.publisherName ?? "Coriiu Solomon" },
  };
}

beforeEach(() => {
  prismaMock.client.findUnique.mockReset();
  Object.values(prismaMock.publishedPeriod).forEach((fn) => fn.mockReset());
  loadOwnerSnapshotMock.mockReset();
  prismaMock.publishedPeriod.findMany.mockResolvedValue([]); // default: no prior published trends
});

describe("publishPeriod", () => {
  it("computes a snapshot and upserts a PublishedPeriod with hash + staleSince=null", async () => {
    prismaMock.client.findUnique.mockResolvedValue(makeActiveClient());
    loadOwnerSnapshotMock.mockResolvedValue(makeSnapshot());
    prismaMock.publishedPeriod.upsert.mockResolvedValue(
      makePublishedRow({ year: 2026, month: 4, snapshotHash: "abc123" })
    );

    const result = await publishPeriod({
      clientId: "client-1",
      year: 2026,
      month: 4,
      publishedBy: "accountant-1",
      noteForOwner: "Salariile decembrie incluse",
    });

    expect(loadOwnerSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-1", year: 2026, month: 4 })
    );
    const upsertArgs = prismaMock.publishedPeriod.upsert.mock.calls[0][0];
    expect(upsertArgs.create.staleSince).toBeNull();
    expect(upsertArgs.update.staleSince).toBeNull();
    expect(upsertArgs.create.snapshotHash).toBeTypeOf("string");
    expect(upsertArgs.create.snapshotHash.length).toBeGreaterThan(20);
    expect(result.year).toBe(2026);
    expect(result.stale).toBe(false);
  });

  it("rejects invalid year/month", async () => {
    await expect(
      publishPeriod({ clientId: "client-1", year: 1800, month: 4, publishedBy: "u" })
    ).rejects.toThrow(/An invalid/);
    await expect(
      publishPeriod({ clientId: "client-1", year: 2026, month: 13, publishedBy: "u" })
    ).rejects.toThrow(/Luna invalida/);
  });

  it("refuses to publish for inactive or missing client", async () => {
    prismaMock.client.findUnique.mockResolvedValue(null);
    await expect(
      publishPeriod({ clientId: "missing", year: 2026, month: 4, publishedBy: "u" })
    ).rejects.toThrow(/nu exista/);

    prismaMock.client.findUnique.mockResolvedValue({
      ...makeActiveClient(),
      active: false,
    });
    await expect(
      publishPeriod({ clientId: "client-1", year: 2026, month: 4, publishedBy: "u" })
    ).rejects.toThrow();
  });

  it("re-publish is idempotent at the row level (upsert called with same composite key)", async () => {
    prismaMock.client.findUnique.mockResolvedValue(makeActiveClient());
    loadOwnerSnapshotMock.mockResolvedValue(makeSnapshot());
    prismaMock.publishedPeriod.upsert.mockResolvedValue(
      makePublishedRow({ year: 2026, month: 4 })
    );

    await publishPeriod({ clientId: "client-1", year: 2026, month: 4, publishedBy: "a1" });
    await publishPeriod({ clientId: "client-1", year: 2026, month: 4, publishedBy: "a1" });

    expect(prismaMock.publishedPeriod.upsert).toHaveBeenCalledTimes(2);
    const lastCall = prismaMock.publishedPeriod.upsert.mock.calls[1][0];
    expect(lastCall.where.clientId_year_month).toEqual({
      clientId: "client-1",
      year: 2026,
      month: 4,
    });
  });

  it("trends reuse: prior published trend points override the live-computed ones", async () => {
    prismaMock.client.findUnique.mockResolvedValue(makeActiveClient());

    const liveTrendForMarch = {
      year: 2026,
      month: 3,
      monthLabel: "Mar",
      revenue: 999,
      expenses: 333,
      profit: 666,
      cashEnd: 1000,
      receivables: 0,
      payables: 0,
    };
    loadOwnerSnapshotMock.mockResolvedValue(
      makeSnapshot({ trends: [liveTrendForMarch] })
    );

    // March was previously published with a different (canonical) value:
    const publishedMarchTrend = { ...liveTrendForMarch, revenue: 1234, profit: 900 };
    prismaMock.publishedPeriod.findMany.mockResolvedValue([
      {
        year: 2026,
        month: 3,
        snapshotData: makeSnapshot({
          trends: [publishedMarchTrend],
          meta: {
            clientId: "client-1",
            name: "QHM21 NETWORK SRL",
            cui: "RO31679778",
            slug: "qhm21-network-srl",
            year: 2026,
            month: 3,
            periodLabel: "Martie 2026",
          },
        }),
      },
    ]);

    prismaMock.publishedPeriod.upsert.mockImplementation(async (args: never) => {
      // capture the snapshot the service stored
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stored = (args as any).create.snapshotData as OwnerSnapshot;
      return makePublishedRow({ year: 2026, month: 4, snapshot: stored });
    });

    await publishPeriod({ clientId: "client-1", year: 2026, month: 4, publishedBy: "a1" });

    const stored = (
      prismaMock.publishedPeriod.upsert.mock.calls[0][0].create.snapshotData
    ) as OwnerSnapshot;
    const marchPoint = stored.trends.find((t) => t.year === 2026 && t.month === 3)!;
    expect(marchPoint.revenue).toBe(1234);
    expect(marchPoint.profit).toBe(900);
  });
});

describe("unpublishPeriod", () => {
  it("deletes the matching row and returns true if found", async () => {
    prismaMock.publishedPeriod.deleteMany.mockResolvedValue({ count: 1 });
    const ok = await unpublishPeriod({ clientId: "client-1", year: 2026, month: 4 });
    expect(ok).toBe(true);
  });

  it("returns false when no row exists", async () => {
    prismaMock.publishedPeriod.deleteMany.mockResolvedValue({ count: 0 });
    const ok = await unpublishPeriod({ clientId: "client-1", year: 2026, month: 4 });
    expect(ok).toBe(false);
  });
});

describe("getLatestPublished*", () => {
  it("returns null when client has no publications", async () => {
    prismaMock.publishedPeriod.findFirst.mockResolvedValue(null);
    expect(await getLatestPublishedPeriod("client-1")).toBeNull();
    expect(await getLatestPublishedView("client-1")).toBeNull();
  });

  it("returns the latest period; stale=false when staleSince is null", async () => {
    prismaMock.publishedPeriod.findFirst.mockResolvedValue(
      makePublishedRow({ year: 2026, month: 4, staleSince: null })
    );
    const view = await getLatestPublishedView("client-1");
    expect(view!.year).toBe(2026);
    expect(view!.month).toBe(4);
    expect(view!.stale).toBe(false);
  });

  it("returns stale=true when staleSince is set", async () => {
    prismaMock.publishedPeriod.findFirst.mockResolvedValue(
      makePublishedRow({ year: 2026, month: 4, staleSince: new Date() })
    );
    const view = await getLatestPublishedView("client-1");
    expect(view!.stale).toBe(true);
  });
});

describe("getPublishedView (specific period)", () => {
  it("returns null when that (year, month) is not published", async () => {
    prismaMock.publishedPeriod.findUnique.mockResolvedValue(null);
    expect(await getPublishedView("client-1", 2026, 3)).toBeNull();
  });

  it("returns the full snapshot when found", async () => {
    prismaMock.publishedPeriod.findUnique.mockResolvedValue(
      makePublishedRow({ year: 2026, month: 3 })
    );
    const view = await getPublishedView("client-1", 2026, 3);
    expect(view).not.toBeNull();
    expect(view!.snapshot.meta).toEqual(
      expect.objectContaining({ clientId: "client-1" })
    );
  });
});

describe("listPublishedPeriods", () => {
  it("returns all periods sorted desc with stale flag from column", async () => {
    prismaMock.publishedPeriod.findMany.mockResolvedValue([
      makePublishedRow({ year: 2026, month: 4, id: "p2", staleSince: new Date() }),
      makePublishedRow({ year: 2026, month: 3, id: "p1" }),
    ]);
    const rows = await listPublishedPeriods("client-1");
    expect(rows).toHaveLength(2);
    expect(rows[0].month).toBe(4);
    expect(rows[0].stale).toBe(true);
    expect(rows[1].month).toBe(3);
    expect(rows[1].stale).toBe(false);
  });
});

describe("markPeriodsAsStale", () => {
  it("updates only rows where staleSince is currently null (idempotent)", async () => {
    prismaMock.publishedPeriod.updateMany.mockResolvedValue({ count: 2 });
    await markPeriodsAsStale("client-1", [
      { year: 2026, month: 4 },
      { year: 2026, month: 3 },
    ]);
    const args = prismaMock.publishedPeriod.updateMany.mock.calls[0][0];
    expect(args.where).toEqual(
      expect.objectContaining({ clientId: "client-1", staleSince: null })
    );
    expect(args.data.staleSince).toBeInstanceOf(Date);
  });

  it("is a no-op when given an empty period list", async () => {
    await markPeriodsAsStale("client-1", []);
    expect(prismaMock.publishedPeriod.updateMany).not.toHaveBeenCalled();
  });
});

describe("multi-tenant isolation", () => {
  it("publishing for client A does not write rows for client B", async () => {
    prismaMock.client.findUnique.mockResolvedValue({ ...makeActiveClient("A"), id: "A" });
    loadOwnerSnapshotMock.mockResolvedValue(makeSnapshot());
    prismaMock.publishedPeriod.upsert.mockResolvedValue(
      makePublishedRow({ clientId: "A", year: 2026, month: 4 })
    );

    await publishPeriod({ clientId: "A", year: 2026, month: 4, publishedBy: "acc" });

    const call = prismaMock.publishedPeriod.upsert.mock.calls[0][0];
    expect(call.where.clientId_year_month.clientId).toBe("A");
    expect(call.create.clientId).toBe("A");
  });

  it("listing for client A never returns client B rows (query scoped by clientId)", async () => {
    prismaMock.publishedPeriod.findMany.mockResolvedValue([]);
    await listPublishedPeriods("A");
    expect(prismaMock.publishedPeriod.findMany.mock.calls[0][0].where).toEqual({
      clientId: "A",
    });
  });

  it("two accountants publishing different clients are independent", async () => {
    prismaMock.client.findUnique
      .mockResolvedValueOnce({ ...makeActiveClient("A"), id: "A" })
      .mockResolvedValueOnce({ ...makeActiveClient("B"), id: "B" });
    loadOwnerSnapshotMock.mockResolvedValue(makeSnapshot());
    prismaMock.publishedPeriod.upsert
      .mockResolvedValueOnce(makePublishedRow({ clientId: "A", year: 2026, month: 4 }))
      .mockResolvedValueOnce(makePublishedRow({ clientId: "B", year: 2026, month: 4 }));

    await publishPeriod({ clientId: "A", year: 2026, month: 4, publishedBy: "acc1" });
    await publishPeriod({ clientId: "B", year: 2026, month: 4, publishedBy: "acc2" });

    expect(prismaMock.publishedPeriod.upsert.mock.calls[0][0].create.clientId).toBe("A");
    expect(prismaMock.publishedPeriod.upsert.mock.calls[1][0].create.clientId).toBe("B");
  });
});
