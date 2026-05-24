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
    hasAnalyticVerticalOverride: false,
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
});
