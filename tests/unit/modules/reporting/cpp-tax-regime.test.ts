import { describe, it, expect } from "vitest";
import { computeCpp } from "@/modules/reporting/cpp";
import { loadCatalogSync } from "@/modules/accounts";
import type { BalanceRowView } from "@/modules/balances";

/**
 * D13 contract: the CPP "Impozit" line maps to the correct account
 * based on Client.taxRegime.
 *
 * See docs/decisions/0001-plan-de-conturi-refactor.md D13.
 */

const CATALOG = loadCatalogSync();

function row(
  cont: string,
  fields: Partial<BalanceRowView> = {}
): BalanceRowView {
  return {
    cont,
    contBase: cont,
    denumire: "",
    tip: "A",
    unmapped: false,
    isLeaf: true,
    isExtraBilantier: false,
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
    ...fields,
  };
}

function findImpozitLine(cpp: ReturnType<typeof computeCpp>) {
  return cpp.lines.find(
    (l) => !l.isTotal && !l.isHeader && l.denumire.toLowerCase().includes("impozit")
  );
}

describe("D13 — CPP impozit line maps to taxRegime", () => {
  it("profit_standard regime uses 691", () => {
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("691", { rulajTD: 5000 }), // standard profit tax
      row("698", { rulajTD: 1000 }), // micro — should be IGNORED for standard regime
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "profit_standard" });
    const impozit = findImpozitLine(cpp);
    expect(impozit?.cont).toBe("691");
    expect(impozit?.value).toBe(5000);
    expect(cpp.rezultatNet).toBe(35000); // 100000 − 60000 − 5000
  });

  it("profit_micro_1 regime uses 698, ignores 691", () => {
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("691", { rulajTD: 5000 }), // standard — IGNORED for micro
      row("698", { rulajTD: 1000 }), // micro — used
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "profit_micro_1" });
    const impozit = findImpozitLine(cpp);
    expect(impozit?.cont).toBe("698");
    expect(impozit?.value).toBe(1000);
    expect(cpp.rezultatNet).toBe(39000); // 100000 − 60000 − 1000
  });

  it("imca regime uses 697", () => {
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("697", { rulajTD: 8000 }),
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "imca" });
    const impozit = findImpozitLine(cpp);
    expect(impozit?.cont).toBe("697");
    expect(impozit?.value).toBe(8000);
  });

  it("default (no taxRegime) sums all isProfitTax accounts — legacy behavior", () => {
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("691", { rulajTD: 5000 }),
      row("698", { rulajTD: 1000 }),
    ];
    const cpp = computeCpp(rows, CATALOG);
    const impozit = findImpozitLine(cpp);
    expect(impozit?.value).toBe(6000); // both summed
  });

  it("profit-tax accounts are ALWAYS excluded from cheltuieli exploatare regardless of regime", () => {
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("691", { rulajTD: 5000 }),
      row("697", { rulajTD: 3000 }),
      row("698", { rulajTD: 1000 }),
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "profit_micro_1" });
    // Cheltuieli exploatare should be 60000, not 60000 + 5000 + 3000 + 1000
    expect(cpp.cheltuieliExploatare).toBe(60000);
  });

  it("no impozit line when tax value is zero (micro firm with no tax yet)", () => {
    const rows = [
      row("704", { rulajTC: 10000 }),
      row("641", { rulajTD: 5000 }),
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "profit_micro_1" });
    expect(findImpozitLine(cpp)).toBeUndefined();
    expect(cpp.rezultatNet).toBe(5000);
  });
});

describe("CPP — profit tax uses rulajTD only (consistent with all expenses)", () => {
  it("uses rulajTD even when rulajTC mirrors it from closing entries", () => {
    // Monthly closing entries (D:691 C:121 → reversed as D:121 C:691) produce
    // rulajTD = rulajTC. Using TD − TC would net to zero and hide the tax.
    // We use TD only, same as all other expense accounts in groupByCppSection.
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("691", { rulajTD: 5000, rulajTC: 5000 }),
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "profit_standard" });
    const impozit = findImpozitLine(cpp);
    expect(impozit).toBeDefined();
    expect(impozit!.value).toBe(5000);
    expect(cpp.rezultatNet).toBe(35000);
  });

  it("shows correct impozit when no closing entries exist (TC = 0)", () => {
    const rows = [
      row("704", { rulajTC: 100000 }),
      row("641", { rulajTD: 60000 }),
      row("691", { rulajTD: 5000 }),
    ];
    const cpp = computeCpp(rows, CATALOG, { taxRegime: "profit_standard" });
    const impozit = findImpozitLine(cpp);
    expect(impozit).toBeDefined();
    expect(impozit!.value).toBe(5000);
    expect(cpp.rezultatNet).toBe(35000);
  });
});
