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

describe("computeCppF20 — core routing (OMF 2036/2025)", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("routes cifra de afaceri to rd.03 / rd.04 / rd.05 (productie, marfuri, reduceri)", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "707", contBase: "707", rulajTC: 30000 }),
      row({ cont: "709", contBase: "709", rulajTD: 500 }),
    ]);
    expect(get(cpp.lines, "03").value).toBe(100000);
    expect(get(cpp.lines, "04").value).toBe(30000);
    expect(get(cpp.lines, "05").value).toBe(500);
    expect(get(cpp.lines, "01").value).toBe(100000 + 30000 - 500);
  });

  it("aggregates all production revenues 701-708 under rd.03", () => {
    const cpp = computeCppF20([
      row({ cont: "701", contBase: "701", rulajTC: 1000 }),
      row({ cont: "702", contBase: "702", rulajTC: 2000 }),
      row({ cont: "703", contBase: "703", rulajTC: 3000 }),
      row({ cont: "705", contBase: "705", rulajTC: 4000 }),
      row({ cont: "706", contBase: "706", rulajTC: 5000 }),
      row({ cont: "708", contBase: "708", rulajTC: 6000 }),
    ]);
    expect(get(cpp.lines, "03").value).toBe(21000);
  });

  it("splits class 64x between rd.25 salarii and rd.26 asigurari sociale", () => {
    const cpp = computeCppF20([
      row({ cont: "641", contBase: "641", rulajTD: 60000 }),
      row({ cont: "642", contBase: "642", rulajTD: 5000 }),
      row({ cont: "6451", contBase: "6451", rulajTD: 9000 }),
      row({ cont: "646", contBase: "646", rulajTD: 1500 }),
    ]);
    expect(get(cpp.lines, "25").value).toBe(65000);
    expect(get(cpp.lines, "26").value).toBe(10500);
    expect(get(cpp.lines, "24").value).toBe(75500);
  });

  it("splits class 60x materials into dedicated rows (17/18/19/22/23)", () => {
    const cpp = computeCppF20([
      row({ cont: "601", contBase: "601", rulajTD: 10000 }), // rd.17
      row({ cont: "603", contBase: "603", rulajTD: 1000 }),  // rd.18
      row({ cont: "605", contBase: "605", rulajTD: 2000 }),  // rd.19
      row({ cont: "607", contBase: "607", rulajTD: 50000 }), // rd.22
      row({ cont: "609", contBase: "609", rulajTC: 300 }),   // rd.23 (subtracted)
    ]);
    expect(get(cpp.lines, "17").value).toBe(10000);
    expect(get(cpp.lines, "18").value).toBe(1000);
    expect(get(cpp.lines, "19").value).toBe(2000);
    expect(get(cpp.lines, "22").value).toBe(50000);
    expect(get(cpp.lines, "23").value).toBe(300);
  });

  it("6051 (energie) and 6053 (gaze) land on dedicated info rows 20/21", () => {
    const cpp = computeCppF20([
      row({ cont: "6051", contBase: "6051", rulajTD: 8000 }),
      row({ cont: "6053", contBase: "6053", rulajTD: 4000 }),
    ]);
    expect(get(cpp.lines, "20").value).toBe(8000);
    expect(get(cpp.lines, "21").value).toBe(4000);
  });

  it("prestatii externe 611-628 aggregate into rd.35", () => {
    const cpp = computeCppF20([
      row({ cont: "611", contBase: "611", rulajTD: 1000 }),
      row({ cont: "622", contBase: "622", rulajTD: 2000 }),
      row({ cont: "627", contBase: "627", rulajTD: 500 }),
      row({ cont: "628", contBase: "628", rulajTD: 3000 }),
    ]);
    expect(get(cpp.lines, "35").value).toBe(6500);
  });

  it("666 dobanzi goes to rd.68 (dedicated row), 665 to rd.70 (alte chelt. financiare)", () => {
    const cpp = computeCppF20([
      row({ cont: "666", contBase: "666", rulajTD: 4500 }),
      row({ cont: "665", contBase: "665", rulajTD: 200 }),
    ]);
    expect(get(cpp.lines, "68").value).toBe(4500);
    expect(get(cpp.lines, "70").value).toBe(200);
  });

  it("725 (productie investitii imobiliare) lands on dedicated rd.11", () => {
    const cpp = computeCppF20([
      row({ cont: "725", contBase: "725", rulajTC: 25000 }),
    ]);
    expect(get(cpp.lines, "11").value).toBe(25000);
  });

  it("7412-7419 subventii land on rd.12 (dedicated, separated from rd.06)", () => {
    const cpp = computeCppF20([
      row({ cont: "7411", contBase: "7411", rulajTC: 5000 }), // rd.06
      row({ cont: "7412", contBase: "7412", rulajTC: 3000 }), // rd.12
      row({ cont: "7419", contBase: "7419", rulajTC: 1000 }), // rd.12
    ]);
    expect(get(cpp.lines, "06").value).toBe(5000);
    expect(get(cpp.lines, "12").value).toBe(4000);
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

  it("rd.16 venituri exploatare total includes all A+B section rows", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "725", contBase: "725", rulajTC: 5000 }), // rd.11
    ]);
    expect(get(cpp.lines, "01").value).toBe(100000);
    expect(get(cpp.lines, "11").value).toBe(5000);
    expect(get(cpp.lines, "16").value).toBe(105000);
  });

  it("rd.54 sums cheltuieli exploatare including all sub-rows", () => {
    const cpp = computeCppF20([
      row({ cont: "601", contBase: "601", rulajTD: 10000 }), // rd.17
      row({ cont: "641", contBase: "641", rulajTD: 60000 }), // rd.25
      row({ cont: "6811", contBase: "6811", rulajTD: 5000 }), // rd.28
      row({ cont: "611", contBase: "611", rulajTD: 2000 }),   // rd.35
      row({ cont: "635", contBase: "635", rulajTD: 1500 }),   // rd.46
    ]);
    expect(get(cpp.lines, "17").value).toBe(10000);
    expect(get(cpp.lines, "25").value).toBe(60000);
    expect(get(cpp.lines, "28").value).toBe(5000);
    expect(get(cpp.lines, "35").value).toBe(2000);
    expect(get(cpp.lines, "46").value).toBe(1500);
    expect(get(cpp.lines, "54").value).toBe(78500);
  });

  it("rezultat exploatare = rd.55 (profit) or rd.56 (loss), summary signed", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 60000 }),
    ]);
    expect(get(cpp.lines, "16").value).toBe(100000);
    expect(get(cpp.lines, "54").value).toBe(60000);
    expect(get(cpp.lines, "55").value).toBe(40000);
    expect(get(cpp.lines, "56").value).toBe(0);
    expect(cpp.rezultatExploatare).toBe(40000);
  });

  it("rezultat financiar = rd.72/rd.73, signed in summary", () => {
    const cpp = computeCppF20([
      row({ cont: "766", contBase: "766", rulajTC: 500 }),  // rd.59
      row({ cont: "666", contBase: "666", rulajTD: 1200 }), // rd.68
    ]);
    expect(get(cpp.lines, "64").value).toBe(500);
    expect(get(cpp.lines, "71").value).toBe(1200);
    expect(get(cpp.lines, "73").value).toBe(700);
    expect(cpp.rezultatFinanciar).toBe(-700);
  });

  it("rezultat brut = rd.74 - rd.75", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 40000 }),
      row({ cont: "766", contBase: "766", rulajTC: 500 }),
      row({ cont: "666", contBase: "666", rulajTD: 200 }),
    ]);
    expect(get(cpp.lines, "74").value).toBe(100500);
    expect(get(cpp.lines, "75").value).toBe(40200);
    expect(get(cpp.lines, "76").value).toBe(60300);
    expect(cpp.rezultatBrut).toBe(60300);
  });

  it("rezultat net = rd.76 - rd.78 - rd.79 + rd.80 - rd.81 - rd.82 (default, no regime)", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 100000 }),
      row({ cont: "641", contBase: "641", rulajTD: 60000 }),
      row({ cont: "691", contBase: "691", rulajTD: 6400 }), // rd.78
    ]);
    expect(get(cpp.lines, "76").value).toBe(40000);
    expect(get(cpp.lines, "78").value).toBe(6400);
    expect(get(cpp.lines, "83").value).toBe(33600);
    expect(cpp.rezultatNet).toBe(33600);
  });
});

describe("computeCppF20 — tax regime routing (rd.78-82)", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("default (no regime) includes every profit-tax account on its declared row", () => {
    const cpp = computeCppF20([
      row({ cont: "691", contBase: "691", rulajTD: 1000 }), // rd.78
      row({ cont: "698", contBase: "698", rulajTD: 2000 }), // rd.82
    ]);
    expect(get(cpp.lines, "78").value).toBe(1000);
    expect(get(cpp.lines, "82").value).toBe(2000);
  });

  it("profit_standard restricts impozit to 691 → rd.78 only", () => {
    const cpp = computeCppF20(
      [
        row({ cont: "691", contBase: "691", rulajTD: 1000 }),
        row({ cont: "698", contBase: "698", rulajTD: 2000 }),
      ],
      undefined,
      { taxRegime: "profit_standard" }
    );
    expect(get(cpp.lines, "78").value).toBe(1000);
    expect(get(cpp.lines, "82").value).toBe(0);
  });

  it("profit_micro_1 restricts impozit to 698 → rd.82 only", () => {
    const cpp = computeCppF20(
      [
        row({ cont: "691", contBase: "691", rulajTD: 1000 }),
        row({ cont: "698", contBase: "698", rulajTD: 500 }),
      ],
      undefined,
      { taxRegime: "profit_micro_1" }
    );
    expect(get(cpp.lines, "78").value).toBe(0);
    expect(get(cpp.lines, "82").value).toBe(500);
  });

  it("imca restricts impozit to 697 → rd.81 only", () => {
    const cpp = computeCppF20(
      [
        row({ cont: "697", contBase: "697", rulajTD: 800 }),
        row({ cont: "691", contBase: "691", rulajTD: 1000 }),
      ],
      undefined,
      { taxRegime: "imca" }
    );
    expect(get(cpp.lines, "81").value).toBe(800);
    expect(get(cpp.lines, "78").value).toBe(0);
  });

  it("profit_specific (HoReCa) restricts impozit to 695 → rd.82", () => {
    const cpp = computeCppF20(
      [row({ cont: "695", contBase: "695", rulajTD: 300 })],
      undefined,
      { taxRegime: "profit_specific" }
    );
    expect(get(cpp.lines, "82").value).toBe(300);
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
    expect(get(cpp.lines, "16").value).toBe(0);
    expect(get(cpp.lines, "54").value).toBe(0);
    expect(cpp.rezultatNet).toBe(0);
  });

  it("analytics on P&L accounts aggregate to their base", () => {
    const cpp = computeCppF20([
      row({ cont: "641.A01", contBase: "641", rulajTD: 20000 }),
      row({ cont: "641.A02", contBase: "641", rulajTD: 15000 }),
    ]);
    expect(get(cpp.lines, "25").value).toBe(35000);
  });

  it("longer analytics fall back to catalog prefixes (6451.X -> 6451 -> rd.26)", () => {
    const cpp = computeCppF20([
      row({ cont: "6451.X", contBase: "6451", rulajTD: 9000 }),
    ]);
    expect(get(cpp.lines, "26").value).toBe(9000);
  });
});

describe("computeCppF20 — edge cases", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  it("empty input produces a full F20 skeleton with all zero values", () => {
    const cpp = computeCppF20([]);
    expect(cpp.lines.length).toBe(84);
    expect(cpp.rezultatNet).toBe(0);
    expect(cpp.rezultatBrut).toBe(0);
    expect(cpp.venituriTotale).toBe(0);
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
    expect(cpp.venituriExploatare).toBe(10000);
  });

  it("zero-value P&L rows are reported as zero but still listed", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 0 }),
    ]);
    expect(get(cpp.lines, "03").value).toBe(0);
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
    const rd25 = get(cpp.lines, "25");
    expect(rd25.indent).toBe(1);
    expect(rd25.kind).toBe("detail");
    const rd55 = get(cpp.lines, "55");
    expect(rd55.section).toBe("D");
    expect(rd55.kind).toBe("total");
  });

  it("detail rows expose which accounts contributed", () => {
    const cpp = computeCppF20([
      row({ cont: "641", contBase: "641", rulajTD: 10000 }),
      row({ cont: "642", contBase: "642", rulajTD: 2000 }),
    ]);
    const rd25 = get(cpp.lines, "25");
    expect(rd25.accounts).toEqual(["641", "642"]);
  });

  it("version identifier is propagated from structure seed", () => {
    const cpp = computeCppF20([]);
    expect(cpp.version).toBe("f20-omf2036-2025-v2");
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

  it("supports legacy sub-row ids like 13a, 17b (backwards-compatible parser)", () => {
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

describe("computeCppF20 — catalog routing exclusivity", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  // Regression: 6651 (Diferente nefavorabile curs valutar) is a *financial*
  // expense and must land on rd.70 (Alte cheltuieli financiare), not on
  // rd.28 (a.1) Amortizare imobilizari) or any other unrelated row.
  // Before the fix, the row was leaking into rd.28 because some compute
  // path was matching by prefix only.
  it("6651 lands on rd.70 and on NO other detail row", () => {
    const cpp = computeCppF20([
      row({ cont: "6651", contBase: "6651", rulajTD: 68.41 }),
    ]);

    expect(get(cpp.lines, "70").value).toBeCloseTo(68.41, 2);
    expect(get(cpp.lines, "70").accounts).toEqual(["6651"]);

    // Hard guarantee: every OTHER detail row is zero and lists no 6651.
    const detailLines = cpp.lines.filter((l) => l.kind === "detail" && l.rowNumber !== "70");
    for (const line of detailLines) {
      expect(line.value, `rd.${line.rowNumber} leaked a value for 6651`).toBe(0);
      expect(line.accounts ?? [], `rd.${line.rowNumber} lists 6651 wrongly`).not.toContain("6651");
    }
  });

  it("6811 (amortizare) lands on rd.28 only — sister of 6651 to lock the pair", () => {
    const cpp = computeCppF20([
      row({ cont: "6811", contBase: "6811", rulajTD: 5000 }),
    ]);

    expect(get(cpp.lines, "28").value).toBe(5000);
    expect(get(cpp.lines, "28").accounts).toEqual(["6811"]);

    const otherDetails = cpp.lines.filter((l) => l.kind === "detail" && l.rowNumber !== "28");
    for (const line of otherDetails) {
      expect(line.accounts ?? [], `rd.${line.rowNumber} should not list 6811`).not.toContain("6811");
    }
  });

  /**
   * Drives every account that has a `cppLine` in the OMFP catalog through
   * computeCppF20 in isolation. The contract: the only detail row carrying
   * a non-zero value is the one declared by `cppLine`. Any cross-contamination
   * means we're double-counting or mis-routing — both would silently produce
   * wrong F20 totals on real client data.
   *
   * Dual-row accounts (711/712) are excluded — they are handled by a
   * separate branch and may legitimately appear on rd.07 OR rd.08.
   */
  it("every catalog cppLine routes to exactly one detail row (no leakage)", async () => {
    const { loadCatalogSync } = await import("@/modules/accounts");
    const catalog = loadCatalogSync();

    const DUAL_CODES = new Set(["711", "712"]);
    const VALUE = 1000;
    const violations: string[] = [];

    // Look up the F20 row's `side` to know which rulaj column carries weight.
    // The compute layer reads agg.td when row.side === "D" and agg.tc when
    // row.side === "C". Feeding the wrong side produces 0 even for a perfect
    // mapping, so the test must respect the declared side.
    const structure = (await import("@/modules/reporting/f20-structure")).loadF20Structure();
    const rowSideByNumber = new Map<string, "D" | "C">();
    for (const r of structure.rows) {
      if (r.kind === "detail" && r.side) rowSideByNumber.set(r.rowNumber, r.side);
    }

    for (const [code, account] of catalog) {
      if (!account.cppLine) continue;
      if (DUAL_CODES.has(code)) continue;

      const expected = account.cppLine;
      const side = rowSideByNumber.get(expected);
      if (!side) continue; // info row or unknown — skip

      resetF20Cache();
      const cpp = computeCppF20([
        row({
          cont: code,
          contBase: code,
          rulajTD: side === "D" ? VALUE : 0,
          rulajTC: side === "C" ? VALUE : 0,
        }),
      ]);

      const target = get(cpp.lines, expected);
      if (target.value === 0) {
        violations.push(`${code} (cppLine=${expected}, side=${side}) produced 0 on its target row`);
      }

      for (const line of cpp.lines) {
        if (line.kind !== "detail") continue;
        if (line.rowNumber === expected) continue;
        const accs = line.accounts ?? [];
        if (accs.includes(code)) {
          violations.push(`${code} leaked into rd.${line.rowNumber} (declared rd.${expected})`);
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });

  // Regression: QHM21 SRL aprilie 2026 had 6651 + 704 + 706 + 691 in the
  // balance and the F20 detailed view showed bogus data on rd.28. This
  // test reconstructs that exact balance and verifies every row goes where
  // the contabil expects.
  it("QHM21 Apr 2026 minimal balance routes correctly", () => {
    const cpp = computeCppF20([
      row({ cont: "704", contBase: "704", rulajTC: 2_000_000 }),
      row({ cont: "706", contBase: "706", rulajTC: 107_160.48 }),
      row({ cont: "6651", contBase: "6651", rulajTD: 68.41 }),
      row({ cont: "691", contBase: "691", rulajTD: 58_363 }),
    ]);

    // Section A — Cifra de afaceri
    expect(get(cpp.lines, "03").value).toBeCloseTo(2_107_160.48, 2);
    expect(get(cpp.lines, "03").accounts).toEqual(["704", "706"]);
    expect(get(cpp.lines, "01").value).toBeCloseTo(2_107_160.48, 2);

    // Section C — nothing on amortizare
    expect(get(cpp.lines, "28").value).toBe(0);
    expect(get(cpp.lines, "28").accounts).toBeUndefined();

    // Section F — 6651 here
    expect(get(cpp.lines, "70").value).toBeCloseTo(68.41, 2);
    expect(get(cpp.lines, "70").accounts).toEqual(["6651"]);

    // Section G — impozit 691 on rd.78
    expect(get(cpp.lines, "78").value).toBe(58_363);
    expect(get(cpp.lines, "78").accounts).toEqual(["691"]);

    // Total: profit brut = 2_107_160.48 - 68.41 = 2_107_092.07
    //        profit net = 2_107_092.07 - 58_363 = 2_048_729.07
    expect(cpp.rezultatBrut).toBeCloseTo(2_107_092.07, 2);
    expect(cpp.rezultatNet).toBeCloseTo(2_048_729.07, 2);
  });
});

describe("computeCppF20 — section labels match OMF 2036/2025 layout", () => {
  beforeEach(() => {
    resetF20Cache();
    resetSyncCache();
  });

  /**
   * Section letters in OMF 2036/2025 carry specific meaning that drove the
   * UI label fix. This test pins each section to its canonical content so
   * a future structure edit can't silently shuffle them and break the UI
   * legend.
   */
  it("each section letter contains the canonical row range", () => {
    const cpp = computeCppF20([]);
    const sectionsByRow = new Map(cpp.lines.map((l) => [l.rowNumber, l.section]));

    // A = Cifra de afaceri (rd.01-06)
    expect(sectionsByRow.get("01")).toBe("A");
    expect(sectionsByRow.get("06")).toBe("A");

    // B = Venituri din exploatare (rd.07-16)
    expect(sectionsByRow.get("07")).toBe("B");
    expect(sectionsByRow.get("16")).toBe("B");

    // C = Cheltuieli din exploatare (rd.17-54)
    expect(sectionsByRow.get("17")).toBe("C");
    expect(sectionsByRow.get("54")).toBe("C");

    // D = Rezultat din exploatare (rd.55-56)
    expect(sectionsByRow.get("55")).toBe("D");
    expect(sectionsByRow.get("56")).toBe("D");

    // E = Venituri financiare (rd.57-64)
    expect(sectionsByRow.get("57")).toBe("E");
    expect(sectionsByRow.get("64")).toBe("E");

    // F = Cheltuieli financiare (rd.65-71)
    expect(sectionsByRow.get("65")).toBe("F");
    expect(sectionsByRow.get("71")).toBe("F");

    // G = Rezultat financiar + totale + impozit + rezultat net (rd.72-84)
    expect(sectionsByRow.get("72")).toBe("G");
    expect(sectionsByRow.get("84")).toBe("G");
  });
});
