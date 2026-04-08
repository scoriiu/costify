import { describe, it, expect } from "vitest";
import { computeKpis } from "@/modules/reporting/kpi";
import type { BalanceRowView } from "@/modules/balances";

function makeRow(overrides: Partial<BalanceRowView> & Pick<BalanceRowView, "cont" | "contBase">): BalanceRowView {
  return {
    denumire: "",
    tip: "A",
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

describe("computeKpis", () => {
  it("computes cash & bank from account 5121 + 5124 + 5311", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 50000 }),
      makeRow({ cont: "5124", contBase: "5124", finD: 10000 }),
      makeRow({ cont: "5311", contBase: "5311", finD: 2000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.cashBank).toBe(62000);
  });

  it("computes creante clienti from 4111 finD", () => {
    const rows = [
      makeRow({ cont: "4111.001", contBase: "4111", finD: 15000 }),
      makeRow({ cont: "4111.002", contBase: "4111", finD: 5000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.clientiCreante).toBe(20000);
  });

  it("computes datorii furnizori from 401 + 404 finC", () => {
    const rows = [
      makeRow({ cont: "401.001", contBase: "401", finC: 8000 }),
      makeRow({ cont: "404", contBase: "404", finC: 2000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.furnizoriDatorii).toBe(10000);
  });

  it("computes TVA de plata = 4427.finC - 4426.finD", () => {
    const rows = [
      makeRow({ cont: "4427", contBase: "4427", finC: 5000 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 3000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.tvaDePlata).toBe(2000);
  });

  it("computes negative TVA (de recuperat) when 4426 > 4427", () => {
    const rows = [
      makeRow({ cont: "4427", contBase: "4427", finC: 1000 }),
      makeRow({ cont: "4426", contBase: "4426", finD: 3000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.tvaDePlata).toBe(-2000);
  });

  it("computes total venituri from class 7 rulajTC", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 50000 }),
      makeRow({ cont: "707", contBase: "707", rulajTC: 10000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.totalVenituri).toBe(60000);
  });

  it("computes total cheltuieli from class 6 rulajTD", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajTD: 20000 }),
      makeRow({ cont: "627", contBase: "627", rulajTD: 500 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.totalCheltuieli).toBe(20500);
  });

  it("computes rezultat = venituri - cheltuieli", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 60000 }),
      makeRow({ cont: "612", contBase: "612", rulajTD: 10000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.rezultat).toBe(30000);
  });

  it("computes marja operationala as percentage", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajTC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajTD: 80000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.marjaOperationala).toBe(20);
  });

  it("returns null marja when no revenue", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajTD: 5000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.marjaOperationala).toBeNull();
  });

  it("ignores non-leaf rows", () => {
    const rows = [
      makeRow({ cont: "5121", contBase: "5121", finD: 50000, isLeaf: false, hasChild: true }),
      makeRow({ cont: "5121.001", contBase: "5121", finD: 30000 }),
      makeRow({ cont: "5121.002", contBase: "5121", finD: 20000 }),
    ];

    const kpis = computeKpis(rows);
    expect(kpis.cashBank).toBe(50000);
  });
});
