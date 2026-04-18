import { describe, it, expect } from "vitest";
import { buildPlan } from "@/modules/accounts/plan";
import type {
  CatalogAccount,
  ClientAccountRecord,
} from "@/modules/accounts";

function catalogEntry(
  code: string,
  name: string,
  overrides: Partial<CatalogAccount> = {}
): CatalogAccount {
  return {
    code,
    name,
    type: "B",
    classDigit: parseInt(code[0], 10),
    cppGroup: null,
    cppLabel: null,
    cppLine: null,
    cppLineLabel: null,
    special: null,
    isClosing: false,
    isProfitTax: false,
    isProfitDistribution: false,
    isExtraBilantier: false,
    isIfrsOnly: false,
    cashRole: null,
    arRole: null,
    apRole: null,
    vatRole: null,
    payrollRole: null,
    ...overrides,
  };
}

function clientEntry(
  code: string,
  customName: string,
  overrides: Partial<ClientAccountRecord> = {}
): ClientAccountRecord {
  return {
    code,
    customName,
    source: "saga_import",
    partnerCode: null,
    needsReview: false,
    firstSeenAt: new Date("2025-01-10"),
    lastSeenAt: new Date("2025-03-20"),
    ...overrides,
  };
}

describe("buildPlan — basic composition", () => {
  it("returns empty array when no inputs", () => {
    const plan = buildPlan({
      catalog: new Map(),
      clientAccounts: new Map(),
      usage: new Map(),
    });
    expect(plan).toEqual([]);
  });

  it("combines accounts from clientAccounts + usage + balance rows (union)", () => {
    const catalog = new Map([
      ["401", catalogEntry("401", "Furnizori")],
      ["5121", catalogEntry("5121", "Conturi la banci", { type: "A" })],
    ]);
    const clientAccounts = new Map([
      ["401.00023", clientEntry("401.00023", "Orange")],
    ]);
    const usage = new Map([
      ["5121", { firstSeen: new Date("2025-01-01"), lastSeen: new Date("2025-04-01"), entriesCount: 42 }],
    ]);
    const balanceRows = [{ cont: "4111.001", finD: 1000, finC: 0 }];

    const plan = buildPlan({ catalog, clientAccounts, usage, balanceRows });
    expect(plan.map((r) => r.cont)).toEqual(["401.00023", "4111.001", "5121"]);
  });

  it("deduplicates codes present in multiple sources", () => {
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);
    const clientAccounts = new Map([["401.00023", clientEntry("401.00023", "Orange")]]);
    const usage = new Map([
      ["401.00023", { firstSeen: new Date(), lastSeen: new Date(), entriesCount: 5 }],
    ]);
    const balanceRows = [{ cont: "401.00023", finD: 0, finC: 500 }];

    const plan = buildPlan({ catalog, clientAccounts, usage, balanceRows });
    expect(plan.length).toBe(1);
    expect(plan[0].cont).toBe("401.00023");
  });
});

describe("buildPlan — kind + isInCatalog + needsReview", () => {
  it("standard account: code is in catalog, kind=standard, isInCatalog=true, needsReview=false", () => {
    const catalog = new Map([["5121", catalogEntry("5121", "Banca")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map(),
      usage: new Map([["5121", stats()]]),
    });
    expect(plan[0].kind).toBe("standard");
    expect(plan[0].isInCatalog).toBe(true);
    expect(plan[0].needsReview).toBe(false);
  });

  it("analytic with known base: kind=analytic, isInCatalog=true, needsReview=false", () => {
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map([["401.00023", clientEntry("401.00023", "Orange")]]),
      usage: new Map(),
    });
    expect(plan[0].kind).toBe("analytic");
    expect(plan[0].isInCatalog).toBe(true);
    expect(plan[0].needsReview).toBe(false);
  });

  it("analytic with UNKNOWN base and review flag: needsReview=true", () => {
    // Realistic: import sets needsReview=true when base isn't in catalog (D14).
    const plan = buildPlan({
      catalog: new Map(),
      clientAccounts: new Map([
        ["6588.001", clientEntry("6588.001", "Custom expense", { needsReview: true })],
      ]),
      usage: new Map(),
    });
    expect(plan[0].kind).toBe("analytic");
    expect(plan[0].isInCatalog).toBe(false);
    expect(plan[0].needsReview).toBe(true);
  });

  it("analytic with UNKNOWN base and NO client record: needsReview inferred to true", () => {
    // Account seen only in journal usage, never written to ClientAccount.
    // Fallback: infer from isInCatalog.
    const plan = buildPlan({
      catalog: new Map(),
      clientAccounts: new Map(),
      usage: new Map([["6588.001", stats()]]),
    });
    expect(plan[0].needsReview).toBe(true);
  });

  it("explicit needsReview=false on client record overrides inferred flag", () => {
    // Accountant marked an unknown analytic as reviewed-and-approved.
    const plan = buildPlan({
      catalog: new Map(),
      clientAccounts: new Map([
        ["6588.001", clientEntry("6588.001", "Reviewed custom", { needsReview: false })],
      ]),
      usage: new Map(),
    });
    expect(plan[0].needsReview).toBe(false);
  });
});

describe("buildPlan — name resolution priority", () => {
  it("uses client customName when ClientAccount row exists", () => {
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map([["401.00023", clientEntry("401.00023", "Orange Romania SA")]]),
      usage: new Map(),
    });
    expect(plan[0].name).toBe("Orange Romania SA");
    expect(plan[0].nameSource).toBe("client_import");
  });

  it("uses OMFP catalog name for standard codes with no client record", () => {
    const catalog = new Map([["5121", catalogEntry("5121", "Conturi la banci in lei")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map(),
      usage: new Map([["5121", stats()]]),
    });
    expect(plan[0].name).toBe("Conturi la banci in lei");
    expect(plan[0].nameSource).toBe("omfp_catalog");
  });

  it("analytic without client record falls back to base account name", () => {
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map(),
      usage: new Map([["401.00023", stats()]]),
    });
    expect(plan[0].name).toBe("Furnizori"); // inherited from base
    expect(plan[0].nameSource).toBe("omfp_catalog");
  });

  it("unknown code falls back to 'Cont NNNN'", () => {
    const plan = buildPlan({
      catalog: new Map(),
      clientAccounts: new Map(),
      usage: new Map([["9999.1", stats()]]),
    });
    expect(plan[0].name).toBe("Cont 9999.1");
    expect(plan[0].nameSource).toBe("fallback");
  });

  it("user_edit source is tagged as client_edit in plan row", () => {
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map([
        ["401.00023", clientEntry("401.00023", "Orange RO", { source: "user_edit" })],
      ]),
      usage: new Map(),
    });
    expect(plan[0].nameSource).toBe("client_edit");
  });
});

describe("buildPlan — usage stats", () => {
  it("populates usage from stats map", () => {
    const first = new Date("2025-01-15");
    const last = new Date("2025-05-20");
    const plan = buildPlan({
      catalog: new Map([["5121", catalogEntry("5121", "Banca")]]),
      clientAccounts: new Map(),
      usage: new Map([["5121", { firstSeen: first, lastSeen: last, entriesCount: 123 }]]),
    });
    expect(plan[0].usage.firstSeen).toEqual(first);
    expect(plan[0].usage.lastSeen).toEqual(last);
    expect(plan[0].usage.entriesCount).toBe(123);
  });

  it("nullifies usage when stats missing", () => {
    const plan = buildPlan({
      catalog: new Map(),
      clientAccounts: new Map([["401.001", clientEntry("401.001", "Test")]]),
      usage: new Map(),
    });
    expect(plan[0].usage.firstSeen).toBeNull();
    expect(plan[0].usage.lastSeen).toBeNull();
    expect(plan[0].usage.entriesCount).toBe(0);
  });
});

describe("buildPlan — current sold", () => {
  it("populates currentSold from balance rows when present", () => {
    const plan = buildPlan({
      catalog: new Map([["5121", catalogEntry("5121", "Banca")]]),
      clientAccounts: new Map(),
      usage: new Map(),
      balanceRows: [{ cont: "5121", finD: 12345.67, finC: 0 }],
    });
    expect(plan[0].currentSold).toEqual({ finD: 12345.67, finC: 0 });
  });

  it("currentSold is null when no balance rows supplied", () => {
    const plan = buildPlan({
      catalog: new Map([["5121", catalogEntry("5121", "Banca")]]),
      clientAccounts: new Map(),
      usage: new Map([["5121", stats()]]),
    });
    expect(plan[0].currentSold).toBeNull();
  });
});

describe("buildPlan — sorted output", () => {
  it("sorts results by cont code, numeric-aware (4111 before 4118)", () => {
    const catalog = new Map([
      ["401", catalogEntry("401", "F")],
      ["4111", catalogEntry("4111", "C1")],
      ["4118", catalogEntry("4118", "C2")],
      ["5121", catalogEntry("5121", "B")],
    ]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map(),
      usage: new Map([
        ["4118", stats()],
        ["5121", stats()],
        ["4111", stats()],
        ["401", stats()],
      ]),
    });
    expect(plan.map((r) => r.cont)).toEqual(["401", "4111", "4118", "5121"]);
  });

  it("sorts analytics after their base using numeric comparison", () => {
    const catalog = new Map([["401", catalogEntry("401", "F")]]);
    const plan = buildPlan({
      catalog,
      clientAccounts: new Map([
        ["401.00010", clientEntry("401.00010", "A")],
        ["401.00002", clientEntry("401.00002", "B")],
      ]),
      usage: new Map([["401", stats()]]),
    });
    expect(plan.map((r) => r.cont)).toEqual(["401", "401.00002", "401.00010"]);
  });
});

function stats() {
  return {
    firstSeen: new Date("2025-01-01"),
    lastSeen: new Date("2025-12-31"),
    entriesCount: 1,
  };
}
