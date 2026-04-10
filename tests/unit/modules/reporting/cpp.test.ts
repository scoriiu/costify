import { describe, it, expect } from "vitest";
import { computeCpp } from "@/modules/reporting/cpp";
import type { BalanceRowView } from "@/modules/balances";

function makeRow(overrides: Partial<BalanceRowView> & Pick<BalanceRowView, "cont" | "contBase">): BalanceRowView {
  return {
    denumire: "",
    tip: "A",
    unmapped: false,
    isLeaf: true,
    hasChild: false,
    debInit: 0,
    credInit: 0,
    soldInD: 0,
    soldInC: 0,
    debPrec: 0,
    credPrec: 0,
    rulajD: 0,
    rulajC: 0,
    rulajTD: 0,
    rulajTC: 0,
    totalDeb: 0,
    totalCred: 0,
    finD: 0,
    finC: 0,
    ...overrides,
  };
}

describe("computeCpp", () => {
  it("computes basic P&L with revenue and expenses", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
      makeRow({ cont: "612", contBase: "612", rulajTD: 5000 }),
      makeRow({ cont: "627", contBase: "627", rulajTD: 500 }),
    ];

    const cpp = computeCpp(rows);
    expect(cpp.venituriExploatare).toBe(100000);
    expect(cpp.cheltuieliExploatare).toBe(65500);
    expect(cpp.rezultatExploatare).toBe(34500);
    expect(cpp.rezultatBrut).toBe(34500);
    expect(cpp.rezultatNet).toBe(34500);
  });

  it("separates financial from operational", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 80000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 50000 }),
      makeRow({ cont: "766", contBase: "766", rulajTC: 1000 }),
      makeRow({ cont: "666", contBase: "666", rulajTD: 3000 }),
    ];

    const cpp = computeCpp(rows);
    expect(cpp.venituriExploatare).toBe(80000);
    expect(cpp.cheltuieliExploatare).toBe(50000);
    expect(cpp.rezultatExploatare).toBe(30000);
    expect(cpp.venituriFinanciare).toBe(1000);
    expect(cpp.cheltuieliFinanciare).toBe(3000);
    expect(cpp.rezultatFinanciar).toBe(-2000);
    expect(cpp.rezultatBrut).toBe(28000);
  });

  it("subtracts impozit pe profit (691) for net result", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 40000 }),
      makeRow({ cont: "691", contBase: "691", rulajTD: 9600 }),
    ];

    const cpp = computeCpp(rows);
    expect(cpp.rezultatBrut).toBe(60000);
    expect(cpp.rezultatNet).toBe(50400);
  });

  it("handles loss scenario (cheltuieli > venituri)", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 20000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 35000 }),
      makeRow({ cont: "612", contBase: "612", rulajTD: 10000 }),
    ];

    const cpp = computeCpp(rows);
    expect(cpp.rezultatExploatare).toBe(-25000);
    expect(cpp.rezultatNet).toBe(-25000);
  });

  it("skips zero-value accounts in lines", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 10000 }),
      makeRow({ cont: "701", contBase: "701", rulajTC: 0 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 5000 }),
    ];

    const cpp = computeCpp(rows);
    const lineConts = cpp.lines
      .filter((l) => !l.isHeader && !l.isTotal)
      .map((l) => l.cont);

    expect(lineConts).toContain("704");
    expect(lineConts).toContain("641");
    expect(lineConts).not.toContain("701");
  });

  it("generates header, detail, and total lines", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 5000 }),
    ];

    const cpp = computeCpp(rows);
    const headers = cpp.lines.filter((l) => l.isHeader);
    const totals = cpp.lines.filter((l) => l.isTotal);
    const details = cpp.lines.filter((l) => !l.isHeader && !l.isTotal);

    expect(headers.length).toBeGreaterThan(0);
    expect(totals.length).toBeGreaterThan(0);
    expect(details.length).toBeGreaterThan(0);
  });

  it("excludes account 121 from CPP calculations", () => {
    const rows = [
      makeRow({ cont: "121", contBase: "121", rulajTC: 500000, rulajTD: 300000 }),
      makeRow({ cont: "704", contBase: "704", rulajTC: 10000 }),
    ];

    const cpp = computeCpp(rows);
    expect(cpp.venituriExploatare).toBe(10000);
    expect(cpp.cheltuieliExploatare).toBe(0);
  });

  it("handles empty rows", () => {
    const cpp = computeCpp([]);
    expect(cpp.venituriExploatare).toBe(0);
    expect(cpp.cheltuieliExploatare).toBe(0);
    expect(cpp.rezultatNet).toBe(0);
  });
});
