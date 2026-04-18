import { describe, it, expect, beforeEach } from "vitest";
import { computeCppF20, evaluateFormula } from "@/modules/reporting/cpp-f20";
import { resetF20Cache } from "@/modules/reporting/f20-structure";
import { resetSyncCache } from "@/modules/accounts";
import type { BalanceRowView } from "@/modules/balances";
import type { CppF20Line } from "@/modules/reporting/types";

function row(overrides: Partial<BalanceRowView> & Pick<BalanceRowView, "cont" | "contBase">): BalanceRowView {
  return {
    denumire: "",
    tip: "A",
    unmapped: false,
    isExtraBilantier: false,
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

/** Quick lookup: pull one F20 row by its number. */
function get(lines: CppF20Line[], rn: string): CppF20Line {
  const found = lines.find((l) => l.rowNumber === rn);
  if (!found) throw new Error(`Row ${rn} not found in F20 lines`);
  return found;
}

describe("computeCppF20 — core routing", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("maps cifra de afaceri sources to rd.02 / rd.03 / rd.04", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "707", contBase: "707", rulajTC: 30000 }),
      row({ cont: "709", contBase: "709", rulajTD: 500 }),
    ]);
    expect(get(cpp.lines, "02").value).toBe(100000);
    expect(get(cpp.lines, "03").value).toBe(30000);
    expect(get(cpp.lines, "04").value).toBe(500);
    // rd.01 = 02 + 03 - 04
    expect(get(cpp.lines, "01").value).toBe(100000 + 30000 - 500);
  });

  it("routes all production revenues under rd.02", () => {
    const cpp = computeCppF20([
      row({ cont: "701", contBase: "701", rulajTC: 1000 }),
      row({ cont: "702", contBase: "702", rulajTC: 2000 }),
      row({ cont: "703", contBase: "703", rulajTC: 3000 }),
      row({ cont: "705", contBase: "705", rulajTC: 4000 }),
      row({ cont: "706", contBase: "706", rulajTC: 5000 }),
      row({ cont: "708", contBase: "708", rulajTC: 6000 }),
    ]);
    expect(get(cpp.lines, "02").value).toBe(21000);
  });

  it("splits class 64x between rd.14a salarii and rd.14b asigurari", () => {
    const cpp = computeCppF20([
      row({ cont: "641", contBase: "641", rulajTD: 60000 }),
      row({ cont: "642", contBase: "642", rulajTD: 5000 }),
      row({ cont: "6451", contBase: "6451", rulajTD: 9000 }),
      row({ cont: "646", contBase: "646", rulajTD: 1500 }),
    ]);
    expect(get(cpp.lines, "14a").value).toBe(65000);
    expect(get(cpp.lines, "14b").value).toBe(10500);
    expect(get(cpp.lines, "14").value).toBe(75500);
  });

  it("class 60x cheltuieli materiale split by OMFP sub-rows", () => {
    const cpp = computeCppF20([
      row({ cont: "601", contBase: "601", rulajTD: 10000 }), // rd.13a
      row({ cont: "603", contBase: "603", rulajTD: 1000 }),  // rd.13b
      row({ cont: "605", contBase: "605", rulajTD: 2000 }),  // rd.13c
      row({ cont: "607", contBase: "607", rulajTD: 50000 }), // rd.13d
      row({ cont: "609", contBase: "609", rulajTC: 300 }),   // rd.13e, subtracted
    ]);
    expect(get(cpp.lines, "13a").value).toBe(10000);
    expect(get(cpp.lines, "13b").value).toBe(1000);
    expect(get(cpp.lines, "13c").value).toBe(2000);
    expect(get(cpp.lines, "13d").value).toBe(50000);
    expect(get(cpp.lines, "13e").value).toBe(300);
  });

  it("prestatii externe 611-628 aggregate into rd.17a", () => {
    const cpp = computeCppF20([
      row({ cont: "611", contBase: "611", rulajTD: 1000 }),
      row({ cont: "622", contBase: "622", rulajTD: 2000 }),
      row({ cont: "627", contBase: "627", rulajTD: 500 }),
      row({ cont: "628", contBase: "628", rulajTD: 3000 }),
    ]);
    expect(get(cpp.lines, "17a").value).toBe(6500);
  });

  it("666 dobanzi goes to rd.27, not rd.28", () => {
    const cpp = computeCppF20([
      row({ cont: "666", contBase: "666", rulajTD: 4500 }),
      row({ cont: "665", contBase: "665", rulajTD: 200 }),
    ]);
    expect(get(cpp.lines, "27").value).toBe(4500);
    expect(get(cpp.lines, "28").value).toBe(200);
  });
});

describe("computeCppF20 — variatia stocurilor (dual-row split)", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("positive variation on 711/712 routes to rd.07 only", () => {
    const cpp = computeCppF20([
      row({ cont: "711", contBase: "711", rulajTC: 8000, rulajTD: 3000 }),
    ]);
    expect(get(cpp.lines, "07").value).toBe(5000);
    expect(get(cpp.lines, "08").value).toBe(0);
  });

  it("negative variation routes to rd.08 with positive magnitude", () => {
    const cpp = computeCppF20([
      row({ cont: "711", contBase: "711", rulajTC: 2000, rulajTD: 9000 }),
    ]);
    expect(get(cpp.lines, "07").value).toBe(0);
    expect(get(cpp.lines, "08").value).toBe(7000);
  });

  it("712 follows the same dual-row behavior as 711", () => {
    const cpp = computeCppF20([
      row({ cont: "712", contBase: "712", rulajTC: 1000, rulajTD: 5000 }),
    ]);
    expect(get(cpp.lines, "07").value).toBe(0);
    expect(get(cpp.lines, "08").value).toBe(4000);
  });

  it("711 and 712 together net with correct sign", () => {
    const cpp = computeCppF20([
      row({ cont: "711", contBase: "711", rulajTC: 10000, rulajTD: 2000 }), // +8000 → rd.07
      row({ cont: "712", contBase: "712", rulajTC: 1000, rulajTD: 4000 }),  // -3000 → rd.08
    ]);
    expect(get(cpp.lines, "07").value).toBe(8000);
    expect(get(cpp.lines, "08").value).toBe(3000);
  });
});

describe("computeCppF20 — totals and formulas", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("rd.12 sums A section correctly", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "741", contBase: "741", rulajTC: 5000 }), // alte venituri rd.11
    ]);
    expect(get(cpp.lines, "01").value).toBe(100000);
    expect(get(cpp.lines, "11").value).toBe(5000);
    expect(get(cpp.lines, "12").value).toBe(105000);
  });

  it("rd.19 sums cheltuieli exploatare including all sub-rows", () => {
    const cpp = computeCppF20([
      row({ cont: "601", contBase: "601", rulajTD: 10000 }), // 13a
      row({ cont: "641", contBase: "641", rulajTD: 60000 }), // 14a
      row({ cont: "6811", contBase: "6811", rulajTD: 5000 }), // 15a
      row({ cont: "611", contBase: "611", rulajTD: 2000 }), // 17a
      row({ cont: "635", contBase: "635", rulajTD: 1500 }), // 17b
    ]);
    expect(get(cpp.lines, "13a").value).toBe(10000);
    expect(get(cpp.lines, "14a").value).toBe(60000);
    expect(get(cpp.lines, "15a").value).toBe(5000);
    expect(get(cpp.lines, "17a").value).toBe(2000);
    expect(get(cpp.lines, "17b").value).toBe(1500);
    expect(get(cpp.lines, "19").value).toBe(78500);
  });

  it("rd.20 rezultat exploatare = rd.12 - rd.19", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 60000 }),
    ]);
    expect(get(cpp.lines, "12").value).toBe(100000);
    expect(get(cpp.lines, "19").value).toBe(60000);
    expect(get(cpp.lines, "20").value).toBe(40000);
    expect(cpp.rezultatExploatare).toBe(40000);
  });

  it("rd.30 rezultat financiar = rd.25 - rd.29", () => {
    const cpp = computeCppF20([
      row({ cont: "766", contBase: "766", rulajTC: 500 }),  // rd.23
      row({ cont: "666", contBase: "666", rulajTD: 1200 }), // rd.27
    ]);
    expect(get(cpp.lines, "25").value).toBe(500);
    expect(get(cpp.lines, "29").value).toBe(1200);
    expect(get(cpp.lines, "30").value).toBe(-700);
    expect(cpp.rezultatFinanciar).toBe(-700);
  });

  it("rd.33 rezultat brut sums operating and financial results", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 40000 }),
      row({ cont: "766", contBase: "766", rulajTC: 500 }),
      row({ cont: "666", contBase: "666", rulajTD: 200 }),
    ]);
    // rd.33 = rd.31 - rd.32 = (100000+500) - (40000+200)
    expect(get(cpp.lines, "33").value).toBe(60300);
    expect(cpp.rezultatBrut).toBe(60300);
  });

  it("rd.35 rezultat net = rd.33 - rd.34 (impozit)", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 60000 }),
      row({ cont: "691", contBase: "691", rulajTD: 6400 }),
    ]);
    expect(get(cpp.lines, "33").value).toBe(40000);
    expect(get(cpp.lines, "34").value).toBe(6400);
    expect(get(cpp.lines, "35").value).toBe(33600);
    expect(cpp.rezultatNet).toBe(33600);
  });
});

describe("computeCppF20 — tax regime routing (rd.34)", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("default (no regime) includes any profit-tax account", () => {
    const cpp = computeCppF20([
      row({ cont: "691", contBase: "691", rulajTD: 1000 }),
      row({ cont: "698", contBase: "698", rulajTD: 2000 }),
    ]);
    // Both contribute when no regime is specified
    expect(get(cpp.lines, "34").value).toBe(3000);
  });

  it("profit_standard uses only 691", () => {
    const cpp = computeCppF20(
      [
        row({ cont: "691", contBase: "691", rulajTD: 1000 }),
        row({ cont: "698", contBase: "698", rulajTD: 2000 }),
      ],
      undefined,
      { taxRegime: "profit_standard" }
    );
    expect(get(cpp.lines, "34").value).toBe(1000);
  });

  it("profit_micro_1 uses only 698", () => {
    const cpp = computeCppF20(
      [
        row({ cont: "691", contBase: "691", rulajTD: 1000 }),
        row({ cont: "698", contBase: "698", rulajTD: 500 }),
      ],
      undefined,
      { taxRegime: "profit_micro_1" }
    );
    expect(get(cpp.lines, "34").value).toBe(500);
  });

  it("imca uses only 697", () => {
    const cpp = computeCppF20(
      [
        row({ cont: "697", contBase: "697", rulajTD: 800 }),
        row({ cont: "691", contBase: "691", rulajTD: 1000 }),
      ],
      undefined,
      { taxRegime: "imca" }
    );
    expect(get(cpp.lines, "34").value).toBe(800);
  });

  it("profit_specific (HoReCa) uses only 695", () => {
    const cpp = computeCppF20(
      [row({ cont: "695", contBase: "695", rulajTD: 300 })],
      undefined,
      { taxRegime: "profit_specific" }
    );
    expect(get(cpp.lines, "34").value).toBe(300);
  });
});

describe("computeCppF20 — analytic rollup", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("analytics like 401.00023 roll up to their contBase 401 (non-P&L: ignored)", () => {
    const cpp = computeCppF20([
      row({ cont: "401.00023", contBase: "401", rulajTC: 99999 }),
    ]);
    // 401 is not on any F20 line → all rows zero
    expect(get(cpp.lines, "12").value).toBe(0);
    expect(get(cpp.lines, "19").value).toBe(0);
    expect(cpp.rezultatNet).toBe(0);
  });

  it("analytics on P&L accounts aggregate to their base", () => {
    const cpp = computeCppF20([
      row({ cont: "641.A01", contBase: "641", rulajTD: 20000 }),
      row({ cont: "641.A02", contBase: "641", rulajTD: 15000 }),
    ]);
    expect(get(cpp.lines, "14a").value).toBe(35000);
  });

  it("longer analytics fall back to catalog prefixes (6451.X -> 6451)", () => {
    const cpp = computeCppF20([
      row({ cont: "6451.X", contBase: "6451", rulajTD: 9000 }),
    ]);
    expect(get(cpp.lines, "14b").value).toBe(9000);
  });
});

describe("computeCppF20 — edge cases", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("empty input produces a full F20 skeleton with all zero values", () => {
    const cpp = computeCppF20([]);
    expect(cpp.lines.length).toBeGreaterThan(30);
    expect(cpp.rezultatNet).toBe(0);
    expect(cpp.rezultatBrut).toBe(0);
    expect(cpp.venituriTotale).toBe(0);
    // every row is zero
    for (const line of cpp.lines) expect(line.value).toBe(0);
  });

  it("account 121 (closing) is ignored in F20", () => {
    const cpp = computeCppF20([
      row({ cont: "121", contBase: "121", rulajTC: 500000, rulajTD: 300000 }),
      row({ cont: "704", contBase: "704", rulajTC: 10000 }),
    ]);
    expect(cpp.venituriExploatare).toBe(10000);
    expect(cpp.cheltuieliExploatare).toBe(0);
  });

  it("non-leaf rows are filtered out", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 10000, isLeaf: false, hasChild: true }),
      row({ cont: "704.X", contBase: "704", rulajTC: 10000, isLeaf: true }),
    ]);
    // Only the leaf contributes
    expect(cpp.venituriExploatare).toBe(10000);
  });

  it("zero-value P&L rows are reported as zero but still listed", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 0 }),
    ]);
    expect(get(cpp.lines, "02").value).toBe(0);
    // rd.01 must still be present even when all its children are zero
    expect(get(cpp.lines, "01")).toBeDefined();
  });

  it("loss scenario: rezultat brut and rezultat net are negative", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 5000 }),
      row({ cont: "641", contBase: "641", rulajTD: 20000 }),
    ]);
    expect(cpp.rezultatBrut).toBe(-15000);
    expect(cpp.rezultatNet).toBe(-15000);
  });

  it("output rows carry section, indent, kind from structure", () => {
    const cpp = computeCppF20([]);
    const rd01 = get(cpp.lines, "01");
    expect(rd01.section).toBe("A");
    expect(rd01.kind).toBe("subtotal");
    const rd14a = get(cpp.lines, "14a");
    expect(rd14a.indent).toBe(1);
    expect(rd14a.kind).toBe("detail");
    const rd20 = get(cpp.lines, "20");
    expect(rd20.section).toBe("C");
    expect(rd20.kind).toBe("total");
  });

  it("detail rows expose which accounts contributed", () => {
    const cpp = computeCppF20([
      row({ cont: "641", contBase: "641", rulajTD: 10000 }),
      row({ cont: "642", contBase: "642", rulajTD: 2000 }),
    ]);
    const rd14a = get(cpp.lines, "14a");
    expect(rd14a.accounts).toEqual(["641", "642"]);
  });

  it("version identifier is propagated from structure seed", () => {
    const cpp = computeCppF20([]);
    expect(cpp.version).toBe("f20-omfp1802-2024-v1");
  });
});

describe("computeCppF20 — reconciliation with simplified CPP", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("F20 rezultat brut equals simplified rezultat brut", async () => {
    const { computeCpp } = await import("@/modules/reporting/cpp");
    const rows = [
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "707", contBase: "707", rulajTC: 20000 }),
      row({ cont: "601", contBase: "601", rulajTD: 30000 }),
      row({ cont: "641", contBase: "641", rulajTD: 40000 }),
      row({ cont: "611", contBase: "611", rulajTD: 5000 }),
      row({ cont: "766", contBase: "766", rulajTC: 1000 }),
      row({ cont: "666", contBase: "666", rulajTD: 800 }),
    ];
    const simplified = computeCpp(rows);
    const f20 = computeCppF20(rows);
    expect(f20.rezultatBrut).toBe(simplified.rezultatBrut);
    expect(f20.rezultatExploatare).toBe(simplified.rezultatExploatare);
    expect(f20.rezultatFinanciar).toBe(simplified.rezultatFinanciar);
  });

  it("F20 rezultat net equals simplified rezultat net with same tax regime", async () => {
    const { computeCpp } = await import("@/modules/reporting/cpp");
    const rows = [
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 50000 }),
      row({ cont: "691", contBase: "691", rulajTD: 8000 }),
    ];
    const simplified = computeCpp(rows, undefined, { taxRegime: "profit_standard" });
    const f20 = computeCppF20(rows, undefined, { taxRegime: "profit_standard" });
    expect(f20.rezultatNet).toBe(simplified.rezultatNet);
  });
});

describe("evaluateFormula (pure helper)", () => {
  it("handles single row reference", () => {
    const m = new Map([["01", 100]]);
    expect(evaluateFormula("rd.01", m)).toBe(100);
  });

  it("handles addition and subtraction", () => {
    const m = new Map([
      ["01", 100],
      ["02", 30],
      ["03", 5],
    ]);
    expect(evaluateFormula("rd.01 + rd.02 - rd.03", m)).toBe(125);
  });

  it("missing row defaults to 0", () => {
    const m = new Map([["01", 100]]);
    expect(evaluateFormula("rd.01 + rd.99", m)).toBe(100);
  });

  it("supports sub-row ids like 13a, 17b, 26b", () => {
    const m = new Map([
      ["13a", 10],
      ["13b", 20],
      ["13e", 3],
    ]);
    expect(evaluateFormula("rd.13a + rd.13b - rd.13e", m)).toBe(27);
  });

  it("empty formula returns 0", () => {
    expect(evaluateFormula("", new Map())).toBe(0);
  });
});
