import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  loadPartnersForCont,
  loadPartnerSummariesForClient,
} from "@/modules/partner-mappings/loader";

function makePrismaMock(opts: {
  journalLines?: unknown[];
  journalPartners?: unknown[];
  overrides?: unknown[];
} = {}) {
  const journalLineFindMany = vi.fn().mockResolvedValue(opts.journalLines ?? []);
  const journalPartnerFindMany = vi
    .fn()
    .mockResolvedValue(opts.journalPartners ?? []);
  const overrideFindMany = vi.fn().mockResolvedValue(opts.overrides ?? []);

  return {
    journalLine: { findMany: journalLineFindMany },
    journalPartner: { findMany: journalPartnerFindMany },
    partnerCategoryOverride: { findMany: overrideFindMany },
    _spies: {
      journalLineFindMany,
      journalPartnerFindMany,
      overrideFindMany,
    },
  } as unknown as PrismaClient & {
    _spies: {
      journalLineFindMany: ReturnType<typeof vi.fn>;
      journalPartnerFindMany: ReturnType<typeof vi.fn>;
      overrideFindMany: ReturnType<typeof vi.fn>;
    };
  };
}

function jLine(overrides: Record<string, unknown> = {}) {
  return {
    contD: "6022",
    contDBase: "6022",
    contC: "401.001",
    contCBase: "401",
    suma: 100,
    ...overrides,
  };
}

function jPartner(analyticAccount: string, partnerName: string) {
  return { analyticAccount, partnerName };
}

function overrideRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "override-1",
    clientId: "client-1",
    contBase: "6022",
    partnerNameNormalized: "omv petrom",
    partnerNameOriginal: "OMV PETROM SRL",
    categoryId: "cat-combustibil",
    source: "manual" as "manual" | "bulk" | "suggested",
    confirmedAt: new Date("2026-04-15"),
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-15"),
    ...overrides,
  };
}

describe("loadPartnersForCont", () => {
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
  });

  it("returns empty result for a non-6/7 contBase without hitting the DB", async () => {
    const result = await loadPartnersForCont(
      prisma,
      "client-1",
      "5121",
      2026,
      4
    );
    expect(result.partners).toEqual([]);
    expect(prisma._spies.journalLineFindMany).not.toHaveBeenCalled();
  });

  it("filters by contDBase for expense conts (class 6)", async () => {
    await loadPartnersForCont(prisma, "client-1", "6022", 2026, 4);
    const call = prisma._spies.journalLineFindMany.mock.calls[0][0];
    expect(call.where.contDBase).toBe("6022");
    expect(call.where.contCBase).toBeUndefined();
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.year).toBe(2026);
    expect(call.where.month).toEqual({ lte: 4 });
  });

  it("filters by contCBase for revenue conts (class 7)", async () => {
    await loadPartnersForCont(prisma, "client-1", "707", 2026, 4);
    const call = prisma._spies.journalLineFindMany.mock.calls[0][0];
    expect(call.where.contCBase).toBe("707");
    expect(call.where.contDBase).toBeUndefined();
  });

  it("queries overrides scoped to the specific contBase", async () => {
    await loadPartnersForCont(prisma, "client-1", "6022", 2026, 4);
    const call = prisma._spies.overrideFindMany.mock.calls[0][0];
    expect(call.where).toEqual({ clientId: "client-1", contBase: "6022" });
  });

  it("integrates lines + partner names + overrides end-to-end", async () => {
    prisma = makePrismaMock({
      journalLines: [
        jLine({ contC: "401.001", suma: 900 }),
        jLine({ contC: "401.002", suma: 500 }),
      ],
      journalPartners: [
        jPartner("401.001", "SC Logistic SRL"),
        jPartner("401.002", "OMV PETROM SRL"),
      ],
      overrides: [
        overrideRow({
          partnerNameNormalized: "logistic",
          partnerNameOriginal: "SC Logistic SRL",
          categoryId: "cat-curierat",
        }),
      ],
    });

    const result = await loadPartnersForCont(
      prisma,
      "client-1",
      "6022",
      2026,
      4
    );

    expect(result.partners).toHaveLength(2);
    // Logistic comes first only if it has the bigger rulaj — let's verify
    // the expected order by rulaj DESC:
    expect(result.partners[0].nameNormalized).toBe("logistic");
    expect(result.partners[0].rulaj).toBe(900);
    expect(result.partners[0].override?.categoryId).toBe("cat-curierat");
    expect(result.partners[1].nameNormalized).toBe("omv petrom");
    expect(result.partners[1].override).toBeNull();
  });

  it("converts Prisma Decimal-ish suma values via Number()", async () => {
    // Prisma returns Decimal as an object with toString/valueOf — Number()
    // collapses both Decimal and plain numbers to a JS number.
    const decimalLike = {
      toString: () => "123.45",
      valueOf: () => 123.45,
    };
    prisma = makePrismaMock({
      journalLines: [jLine({ contC: "401.001", suma: decimalLike })],
      journalPartners: [jPartner("401.001", "OMV")],
    });

    const result = await loadPartnersForCont(
      prisma,
      "client-1",
      "6022",
      2026,
      4
    );

    expect(result.partners[0].rulaj).toBe(123.45);
  });
});

describe("loadPartnerSummariesForClient", () => {
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
  });

  it("returns empty record when there are no lines and no overrides", async () => {
    const result = await loadPartnerSummariesForClient(
      prisma,
      "client-1",
      2026,
      4
    );
    expect(result).toEqual({});
  });

  it("computes summaries for every cont with activity", async () => {
    prisma = makePrismaMock({
      journalLines: [
        jLine({ contDBase: "6022", contC: "401.001", suma: 900 }),
        jLine({ contDBase: "6022", contC: "401.002", suma: 500 }),
        jLine({ contDBase: "641", contC: "421.001", suma: 5000 }),
        jLine({
          contD: "411.001",
          contDBase: "411",
          contC: "707",
          contCBase: "707",
          suma: 10000,
        }),
      ],
      journalPartners: [
        jPartner("401.001", "OMV"),
        jPartner("401.002", "PETROM"),
        jPartner("421.001", "Salariat 1"),
        jPartner("411.001", "Client Alpha"),
      ],
    });

    const result = await loadPartnerSummariesForClient(
      prisma,
      "client-1",
      2026,
      4
    );

    expect(Object.keys(result).sort()).toEqual(["411", "641", "6022", "707"].sort().filter((k) => ["6022", "641", "707"].includes(k)));
    // The 411 line is captured as part of the 707 bucket (revenue cont):
    expect(result["707"].partnerCount).toBe(1);
    expect(result["707"].totalPartnerRulaj).toBe(10000);
    expect(result["6022"].partnerCount).toBe(2);
    expect(result["6022"].totalPartnerRulaj).toBe(1400);
    expect(result["641"].partnerCount).toBe(1);
  });

  it("includes conts that only have overrides (no journal activity this period)", async () => {
    prisma = makePrismaMock({
      journalLines: [],
      journalPartners: [],
      overrides: [
        overrideRow({
          contBase: "6022",
          partnerNameNormalized: "lukoil",
          partnerNameOriginal: "LUKOIL ROMANIA",
        }),
      ],
    });

    const result = await loadPartnerSummariesForClient(
      prisma,
      "client-1",
      2026,
      4
    );

    expect(result["6022"]).toBeDefined();
    expect(result["6022"].partnerCount).toBe(1);
    expect(result["6022"].mappedPartnerCount).toBe(1);
    expect(result["6022"].totalPartnerRulaj).toBe(0);
  });

  it("ignores conts that aren't class 6 or 7 (defensive — query already filters)", async () => {
    prisma = makePrismaMock({
      journalLines: [
        // This line is in our query result by mistake — verify summary skip:
        jLine({ contD: "5121", contDBase: "5121", contC: "401.001", suma: 100 }),
      ],
      journalPartners: [jPartner("401.001", "OMV")],
    });

    const result = await loadPartnerSummariesForClient(
      prisma,
      "client-1",
      2026,
      4
    );

    expect(result["5121"]).toBeUndefined();
  });

  it("attaches overrides to the right contBase", async () => {
    prisma = makePrismaMock({
      journalLines: [
        jLine({ contDBase: "6022", contC: "401.001", suma: 900 }),
      ],
      journalPartners: [jPartner("401.001", "SC Logistic SRL")],
      overrides: [
        overrideRow({
          contBase: "6022",
          partnerNameNormalized: "logistic",
          partnerNameOriginal: "SC Logistic SRL",
        }),
        // Override for a different cont — should NOT bleed into 6022:
        overrideRow({
          id: "override-2",
          contBase: "611",
          partnerNameNormalized: "alfa",
          partnerNameOriginal: "Alfa SRL",
        }),
      ],
    });

    const result = await loadPartnerSummariesForClient(
      prisma,
      "client-1",
      2026,
      4
    );

    expect(result["6022"].mappedPartnerCount).toBe(1);
    expect(result["6022"].overriddenRulaj).toBe(900);
    expect(result["611"]).toBeDefined(); // override-only cont
    expect(result["611"].mappedPartnerCount).toBe(1);
  });
});
