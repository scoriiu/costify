import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  loadPartnersForCont,
  loadPartnerSummariesForClient,
  loadSuggestionQueue,
} from "@/modules/partner-mappings/loader";

/**
 * The loader now uses `$queryRaw` for journal-line + partner-name reads
 * to bypass Prisma ORM hydration. Tests speak SQL: we mock `$queryRaw`
 * and dispatch the response based on which template literal was used.
 * Overrides still go through prisma.partnerCategoryOverride.findMany via
 * the service layer (unchanged).
 *
 * Helper signature mirrors the inputs each test had before — only the
 * shape of the underlying mock differs.
 */
function makePrismaMock(opts: {
  journalLines?: unknown[];
  journalPartners?: unknown[];
  overrides?: unknown[];
} = {}) {
  const jLines = opts.journalLines ?? [];
  const jPartners = opts.journalPartners ?? [];

  // Normalize suma to a string so the loader's `Number(r.suma)` path matches
  // the prod shape (Postgres `suma::text` casts return strings).
  const normalizedLines = jLines.map((line) => {
    const l = line as Record<string, unknown>;
    return {
      ...l,
      suma: typeof l.suma === "number" ? String(l.suma) : l.suma,
    };
  });

  const queryRawMock = vi.fn((template: TemplateStringsArray | { strings: string[] }, ..._args: unknown[]) => {
    // Detect which logical query is being run by looking at the template
    // strings. We don't need to be exhaustive — we just route based on
    // which TABLE the SQL references.
    const sql = Array.isArray((template as TemplateStringsArray)?.raw)
      ? (template as TemplateStringsArray).raw.join(" ")
      : "";
    if (sql.includes('"JournalLine"')) return Promise.resolve(normalizedLines);
    if (sql.includes('"JournalPartner"')) return Promise.resolve(jPartners);
    return Promise.resolve([]);
  });

  const overrideFindMany = vi.fn().mockResolvedValue(opts.overrides ?? []);

  return {
    $queryRaw: queryRawMock,
    partnerCategoryOverride: { findMany: overrideFindMany },
    _spies: {
      queryRaw: queryRawMock,
      overrideFindMany,
    },
  } as unknown as PrismaClient & {
    _spies: {
      queryRaw: ReturnType<typeof vi.fn>;
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

/** Inspect the most recent $queryRaw call's SQL + interpolated values. */
function queryRawCallSummary(prisma: ReturnType<typeof makePrismaMock>) {
  const calls = prisma._spies.queryRaw.mock.calls;
  return calls.map((args) => {
    const template = args[0] as TemplateStringsArray;
    const sql = Array.isArray(template?.raw) ? template.raw.join("?") : "";
    const values = args.slice(1);
    return { sql, values };
  });
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
    expect(prisma._spies.queryRaw).not.toHaveBeenCalled();
  });

  it("filters by contDBase for expense conts (class 6)", async () => {
    await loadPartnersForCont(prisma, "client-1", "6022", 2026, 4);
    const summaries = queryRawCallSummary(prisma);
    // First call must be the journal-line read for the cont; SQL filters on contDBase.
    const journalCall = summaries.find((s) => s.sql.includes('"JournalLine"'));
    expect(journalCall).toBeDefined();
    expect(journalCall!.sql).toContain('"contDBase" =');
    expect(journalCall!.sql).not.toContain('"contCBase" =');
    // Values: clientId, contBase, year, month.
    expect(journalCall!.values).toContain("6022");
    expect(journalCall!.values).toContain(2026);
    expect(journalCall!.values).toContain(4);
  });

  it("filters by contCBase for revenue conts (class 7)", async () => {
    await loadPartnersForCont(prisma, "client-1", "707", 2026, 4);
    const summaries = queryRawCallSummary(prisma);
    const journalCall = summaries.find((s) => s.sql.includes('"JournalLine"'));
    expect(journalCall).toBeDefined();
    expect(journalCall!.sql).toContain('"contCBase" =');
    expect(journalCall!.sql).not.toContain('"contDBase" =');
  });

  it("Sprint 4: fetches ALL client overrides so the aggregator can compute cross-cont suggestions", async () => {
    await loadPartnersForCont(prisma, "client-1", "6022", 2026, 4);
    const call = prisma._spies.overrideFindMany.mock.calls[0][0];
    // Pre-Sprint 4 this was scoped to a single contBase. Now we fetch all
    // overrides for the client so suggestions can fire from other conts.
    // ADR-0004: the inception view filters to effectiveFrom=0 open versions.
    expect(call.where).toEqual({
      clientId: "client-1",
      effectiveFrom: 0,
      effectiveTo: null,
      categoryId: { not: null },
    });
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
    expect(result.partners[0].nameNormalized).toBe("logistic");
    expect(result.partners[0].rulaj).toBe(900);
    expect(result.partners[0].override?.categoryId).toBe("cat-curierat");
    expect(result.partners[1].nameNormalized).toBe("omv petrom");
    expect(result.partners[1].override).toBeNull();
  });

  it("converts string suma values via Number() (suma::text from Postgres)", async () => {
    prisma = makePrismaMock({
      journalLines: [jLine({ contC: "401.001", suma: "123.45" })],
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
    expect(result["611"]).toBeDefined();
    expect(result["611"].mappedPartnerCount).toBe(1);
  });
});

describe("loadSuggestionQueue", () => {
  it("returns empty queue when there are no overrides anywhere", async () => {
    const prisma = makePrismaMock({
      journalLines: [jLine({ contC: "401.001", suma: 100 })],
      journalPartners: [jPartner("401.001", "OMV")],
      overrides: [],
    });

    const queue = await loadSuggestionQueue(prisma, "client-1", 2026, 4);
    expect(queue).toEqual([]);
  });

  it("surfaces a suggestion for a partner with a cross-cont override", async () => {
    const prisma = makePrismaMock({
      journalLines: [
        jLine({ contDBase: "6022", contC: "401.001", suma: 500 }),
      ],
      journalPartners: [jPartner("401.001", "OMV PETROM SRL")],
      overrides: [
        overrideRow({
          contBase: "611",
          partnerNameNormalized: "omv petrom",
          partnerNameOriginal: "OMV",
          categoryId: "cat-combustibil",
        }),
      ],
    });

    const queue = await loadSuggestionQueue(prisma, "client-1", 2026, 4);

    expect(queue).toHaveLength(1);
    expect(queue[0].contBase).toBe("6022");
    expect(queue[0].partnerNameNormalized).toBe("omv petrom");
    expect(queue[0].suggestedCategoryId).toBe("cat-combustibil");
    expect(queue[0].reasonContBases).toEqual(["611"]);
    expect(queue[0].rulaj).toBe(500);
  });

  it("does NOT surface partners with explicit overrides on the current cont", async () => {
    const prisma = makePrismaMock({
      journalLines: [
        jLine({ contDBase: "6022", contC: "401.001", suma: 500 }),
      ],
      journalPartners: [jPartner("401.001", "OMV")],
      overrides: [
        overrideRow({
          contBase: "6022",
          partnerNameNormalized: "omv",
          categoryId: "cat-combustibil",
        }),
      ],
    });

    const queue = await loadSuggestionQueue(prisma, "client-1", 2026, 4);
    expect(queue).toEqual([]);
  });

  it("sorts queue items by rulaj DESC", async () => {
    const prisma = makePrismaMock({
      journalLines: [
        jLine({ contDBase: "6022", contC: "401.001", suma: 100 }),
        jLine({ contDBase: "6022", contC: "401.002", suma: 900 }),
        jLine({ contDBase: "6022", contC: "401.003", suma: 500 }),
      ],
      journalPartners: [
        jPartner("401.001", "Alfa"),
        jPartner("401.002", "Beta"),
        jPartner("401.003", "Gamma"),
      ],
      overrides: [
        overrideRow({
          id: "o1",
          contBase: "611",
          partnerNameNormalized: "alfa",
          categoryId: "cat-a",
        }),
        overrideRow({
          id: "o2",
          contBase: "611",
          partnerNameNormalized: "beta",
          categoryId: "cat-b",
        }),
        overrideRow({
          id: "o3",
          contBase: "611",
          partnerNameNormalized: "gamma",
          categoryId: "cat-c",
        }),
      ],
    });

    const queue = await loadSuggestionQueue(prisma, "client-1", 2026, 4);
    expect(queue.map((q) => q.partnerNameNormalized)).toEqual([
      "beta",
      "gamma",
      "alfa",
    ]);
  });

  it("collects multiple reason contBases when several conts contributed to a suggestion", async () => {
    const prisma = makePrismaMock({
      journalLines: [
        jLine({ contDBase: "6022", contC: "401.001", suma: 500 }),
      ],
      journalPartners: [jPartner("401.001", "OMV")],
      overrides: [
        overrideRow({
          id: "o1",
          contBase: "611",
          partnerNameNormalized: "omv",
          categoryId: "cat-combustibil",
        }),
        overrideRow({
          id: "o2",
          contBase: "628",
          partnerNameNormalized: "omv",
          categoryId: "cat-combustibil",
        }),
      ],
    });

    const queue = await loadSuggestionQueue(prisma, "client-1", 2026, 4);
    expect(queue[0].reasonContBases.sort()).toEqual(["611", "628"]);
  });
});
