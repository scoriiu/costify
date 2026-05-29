import { describe, it, expect } from "vitest";
import { computeCoverage, type AccountListItem } from "@/modules/categories";

function account(overrides: Partial<AccountListItem> = {}): AccountListItem {
  return {
    cont: "641",
    contBase: "641",
    denumire: "Cheltuieli cu salariile",
    kind: "expense",
    rulajD: 0,
    rulajC: 0,
    currentMapping: null,
    hasAnalyticOverride: false,
    currentAllocation: null,
    effectiveAllocation: { splits: [], source: "default" },
    hasAnalyticVerticalOverride: false,
    partnerCount: 0,
    partnerOverrideCount: 0,
    partnerOverriddenRulaj: 0,
    partnerLobOverrideCount: 0,
    ...overrides,
  };
}

describe("computeCoverage", () => {
  it("returns vacuous 100% coverage for an empty firm", () => {
    const result = computeCoverage([]);
    expect(result).toEqual({
      totalRulaj: 0,
      mappedRulaj: 0,
      unmappedRulaj: 0,
      percent: 100,
      unmappedCount: 0,
      totalAccountCount: 0,
    });
  });

  it("treats every expense account's rulaj as its rulajD", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 1000, rulajC: 0,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
    ]);
    expect(result.totalRulaj).toBe(1000);
    expect(result.mappedRulaj).toBe(1000);
    expect(result.percent).toBe(100);
  });

  it("treats every revenue account's rulaj as its rulajC", () => {
    const result = computeCoverage([
      account({ kind: "revenue", rulajD: 0, rulajC: 5000,
                currentMapping: { categoryId: "cat-2", scope: "contBase" } }),
    ]);
    expect(result.totalRulaj).toBe(5000);
    expect(result.mappedRulaj).toBe(5000);
    expect(result.percent).toBe(100);
  });

  it("counts unmapped accounts and excludes their rulaj from mappedRulaj", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 3000,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
      account({ cont: "605", contBase: "605", kind: "expense", rulajD: 1000,
                currentMapping: null }),
    ]);
    expect(result.totalRulaj).toBe(4000);
    expect(result.mappedRulaj).toBe(3000);
    expect(result.unmappedRulaj).toBe(1000);
    expect(result.percent).toBe(75);
    expect(result.unmappedCount).toBe(1);
    expect(result.totalAccountCount).toBe(2);
  });

  it("computes percent with rounding (ceiling neither favored nor penalized)", () => {
    // 333 / 1000 = 33.3% → rounds to 33
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 333,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
      account({ cont: "605", contBase: "605", kind: "expense", rulajD: 667 }),
    ]);
    expect(result.percent).toBe(33);
  });

  it("uses absolute values so a negative correction account does not subtract", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: -200,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
      account({ cont: "605", contBase: "605", kind: "expense", rulajD: 800 }),
    ]);
    expect(result.totalRulaj).toBe(1000);
    expect(result.mappedRulaj).toBe(200);
    expect(result.percent).toBe(20);
  });

  it("handles a firm where everything is unmapped", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 500, currentMapping: null }),
      account({ cont: "605", contBase: "605", kind: "expense", rulajD: 500,
                currentMapping: null }),
    ]);
    expect(result.percent).toBe(0);
    expect(result.unmappedCount).toBe(2);
    expect(result.mappedRulaj).toBe(0);
    expect(result.unmappedRulaj).toBe(1000);
  });

  it("counts unmapped accounts even when their rulaj is zero", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 1000,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
      account({ cont: "707", contBase: "707", kind: "revenue", rulajC: 0,
                currentMapping: null }),
    ]);
    expect(result.percent).toBe(100); // 1000/1000 of value mapped
    expect(result.unmappedCount).toBe(1); // but one account still unmapped
    expect(result.totalAccountCount).toBe(2);
  });

  it("mixes expense + revenue accounts correctly", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 1500,
                currentMapping: { categoryId: "cat-exp", scope: "contBase" } }),
      account({ cont: "707", contBase: "707", kind: "revenue", rulajC: 2500,
                currentMapping: { categoryId: "cat-rev", scope: "contBase" } }),
      account({ cont: "611", contBase: "611", kind: "expense", rulajD: 1000 }),
    ]);
    expect(result.totalRulaj).toBe(5000);
    expect(result.mappedRulaj).toBe(4000);
    expect(result.percent).toBe(80);
    expect(result.unmappedCount).toBe(1);
  });

  it("rounds rulaj sums to 2 decimals to avoid float drift", () => {
    const result = computeCoverage([
      account({ kind: "expense", rulajD: 0.1,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
      account({ cont: "605", contBase: "605", kind: "expense", rulajD: 0.2,
                currentMapping: { categoryId: "cat-1", scope: "contBase" } }),
    ]);
    expect(result.totalRulaj).toBe(0.3); // not 0.30000000000000004
    expect(result.mappedRulaj).toBe(0.3);
  });

  /* ------------ Sprint 2 — partner-overridden rulaj counts as mapped ------ */

  it("Sprint 2: cont with no mapping but full partner coverage counts 100% mapped", () => {
    const result = computeCoverage([
      account({
        kind: "expense",
        rulajD: 1000,
        currentMapping: null,
        partnerCount: 5,
        partnerOverrideCount: 5,
        partnerOverriddenRulaj: 1000,
      }),
    ]);
    expect(result.percent).toBe(100);
    expect(result.mappedRulaj).toBe(1000);
    expect(result.unmappedCount).toBe(0); // partial-but-positive coverage doesn't count
  });

  it("Sprint 2: cont with no mapping but partial partner coverage gets prorated", () => {
    const result = computeCoverage([
      account({
        kind: "expense",
        rulajD: 1000,
        currentMapping: null,
        partnerCount: 5,
        partnerOverrideCount: 2,
        partnerOverriddenRulaj: 400, // 40% covered
      }),
    ]);
    expect(result.mappedRulaj).toBe(400);
    expect(result.unmappedRulaj).toBe(600);
    expect(result.percent).toBe(40);
    // Crucially: NOT counted as unmappedCount — the cont has SOMETHING.
    expect(result.unmappedCount).toBe(0);
  });

  it("Sprint 2: a cont with cont-mapping ignores partner overrides for coverage", () => {
    // Sprint 6 will use partner overrides to refine WHICH category gets the
    // rulaj. For "is this cont covered?" the cont-mapping is already yes.
    const result = computeCoverage([
      account({
        kind: "expense",
        rulajD: 1000,
        currentMapping: { categoryId: "cat-1", scope: "contBase" },
        partnerOverrideCount: 3,
        partnerOverriddenRulaj: 700,
      }),
    ]);
    expect(result.mappedRulaj).toBe(1000); // full, not 1000 + 700
    expect(result.percent).toBe(100);
  });

  it("Sprint 2: partner-overridden rulaj is capped at cont's natural rulaj", () => {
    // Defensive: if for some reason a sum-of-partners exceeds the cont's
    // total (float drift, ghost lines), we never push mapped above the cont.
    const result = computeCoverage([
      account({
        kind: "expense",
        rulajD: 1000,
        currentMapping: null,
        partnerOverriddenRulaj: 1500, // > cont rulaj, defensive cap
      }),
    ]);
    expect(result.mappedRulaj).toBe(1000);
    expect(result.unmappedRulaj).toBe(0);
    expect(result.percent).toBe(100);
  });

  it("Sprint 2: zero-rulaj cont with override-only entries is fully mapped", () => {
    // Override exists historically but partner didn't invoice this period.
    const result = computeCoverage([
      account({
        kind: "expense",
        rulajD: 0,
        currentMapping: null,
        partnerCount: 1,
        partnerOverrideCount: 1,
        partnerOverriddenRulaj: 0,
      }),
    ]);
    // No rulaj to map, no rulaj overridden — but also no positive override
    // rulaj so we fall through to the unmappedCount branch. This is the
    // correct conservative behaviour: an override on a dormant partner
    // doesn't itself prove the cont is covered for the period.
    expect(result.unmappedCount).toBe(1);
    expect(result.percent).toBe(100); // vacuous because totalRulaj === 0
  });

  it("Sprint 2: mixed firm — cont-mapped + partner-partial + fully-unmapped", () => {
    const result = computeCoverage([
      account({
        cont: "641",
        contBase: "641",
        kind: "expense",
        rulajD: 5000,
        currentMapping: { categoryId: "salarii", scope: "contBase" },
      }),
      account({
        cont: "6022",
        contBase: "6022",
        kind: "expense",
        rulajD: 1000,
        currentMapping: null,
        partnerOverriddenRulaj: 600, // partial: 60%
      }),
      account({
        cont: "628",
        contBase: "628",
        kind: "expense",
        rulajD: 500,
        currentMapping: null,
        partnerOverriddenRulaj: 0, // fully unmapped
      }),
    ]);

    expect(result.totalRulaj).toBe(6500);
    expect(result.mappedRulaj).toBe(5600); // 5000 + 600
    expect(result.unmappedRulaj).toBe(900); // 400 partial + 500 full
    expect(result.unmappedCount).toBe(1); // only the 628 cont
    expect(result.percent).toBe(86); // 5600/6500 ≈ 0.8615
  });

  it("realistic firm shape — 70/20/10 mapped/unmapped/zero spread", () => {
    const result = computeCoverage([
      // The big mapped accounts — what coverage should largely reflect.
      account({ cont: "641.001", contBase: "641", denumire: "Salarii brut",
                kind: "expense", rulajD: 360_728,
                currentMapping: { categoryId: "salarii", scope: "contBase" } }),
      account({ cont: "645.001", contBase: "645", denumire: "Asigurari sociale",
                kind: "expense", rulajD: 95_000,
                currentMapping: { categoryId: "salarii", scope: "contBase" } }),
      account({ cont: "6022", contBase: "6022", denumire: "Combustibil",
                kind: "expense", rulajD: 32_500,
                currentMapping: { categoryId: "combustibil", scope: "contBase" } }),
      // Two unmapped accounts mid-size — what should trigger the warning.
      account({ cont: "628.x", contBase: "628", denumire: "Servicii diverse",
                kind: "expense", rulajD: 8_000,
                currentMapping: null }),
      account({ cont: "658", contBase: "658", denumire: "Cheltuieli exceptionale",
                kind: "expense", rulajD: 2_000,
                currentMapping: null }),
      // Revenue mapped — contributes to total + mapped on the C side.
      account({ cont: "707", contBase: "707", denumire: "Vanzari marfa",
                kind: "revenue", rulajC: 500_000,
                currentMapping: { categoryId: "vanzari", scope: "contBase" } }),
    ]);

    expect(result.totalAccountCount).toBe(6);
    expect(result.unmappedCount).toBe(2);
    expect(result.totalRulaj).toBe(998_228); // 360728+95000+32500+8000+2000+500000
    expect(result.mappedRulaj).toBe(988_228); // total - 10_000 unmapped
    expect(result.unmappedRulaj).toBe(10_000);
    expect(result.percent).toBe(99); // 988228/998228 ≈ 0.9899
  });
});
