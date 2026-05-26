import { describe, it, expect } from "vitest";
import {
  computeExpenseBreakdown,
  computeRevenueBreakdown,
  computeTopMonthlyExpenses,
  computeRunway,
  computeSalaryAffordability,
  computeYoy,
} from "@/modules/reporting/owner/compute";
import { loadCatalogSync } from "@/modules/accounts";
import { makeBalanceRow as makeRow } from "../../../fixtures/balance-rows";
import type {
  FinancialSummary,
  MonthlyTrendPoint,
} from "@/modules/reporting/owner";

const CATALOG = loadCatalogSync();

function summary(over: Partial<FinancialSummary> = {}): FinancialSummary {
  return {
    cifraAfaceriTotal: 0,
    cifraAfaceriLuna: 0,
    cheltuieliTotal: 0,
    cheltuieliLuna: 0,
    venituriLuna: 0,
    soldRegistruCasa: 0,
    soldConturiBancare: 0,
    creditareSocietate: 0,
    clientiNeincasati: 0,
    furnizoriNeachitati: 0,
    ...over,
  };
}

function trend(
  year: number,
  month: number,
  over: Partial<MonthlyTrendPoint> = {}
): MonthlyTrendPoint {
  return {
    year,
    month,
    monthLabel: `${month}/${year}`,
    revenue: 0,
    expenses: 0,
    profit: 0,
    cashEnd: 0,
    receivables: 0,
    payables: 0,
    ...over,
  };
}

describe("computeExpenseBreakdown", () => {
  it("groups class 6 leaves by 2-digit prefix and sorts desc", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 30000 }),
      makeRow({ cont: "642", contBase: "642", rulajD: 5000 }),
      makeRow({ cont: "628", contBase: "628", rulajD: 12000 }),
      makeRow({ cont: "605", contBase: "605", rulajD: 8000 }),
    ];

    const result = computeExpenseBreakdown(rows, CATALOG);

    expect(result.map((r) => r.code)).toEqual(["64", "62", "60"]);
    expect(result[0].value).toBe(35000);
    expect(result[0].label).toBe("Salarii si contributii");
    // percentages should sum to ~100
    const sum = result.reduce((s, r) => s + r.percent, 0);
    expect(sum).toBeGreaterThan(99.5);
    expect(sum).toBeLessThan(100.5);
  });

  it("treats 609 as contra-expense (subtracts rulajC)", () => {
    const rows = [
      makeRow({ cont: "605", contBase: "605", rulajD: 10000 }),
      makeRow({ cont: "609", contBase: "609", rulajC: 3000 }),
    ];

    const result = computeExpenseBreakdown(rows, CATALOG);
    const c60 = result.find((r) => r.code === "60");
    expect(c60?.value).toBe(7000);
  });

  it("skips closing accounts and non-leaves", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 1000 }),
      makeRow({ cont: "6", contBase: "6", rulajD: 99999, isLeaf: false }),
      makeRow({ cont: "121", contBase: "121", rulajD: 99999 }),
    ];

    const result = computeExpenseBreakdown(rows, CATALOG);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("64");
    expect(result[0].value).toBe(1000);
  });

  it("returns empty array when no expenses", () => {
    expect(computeExpenseBreakdown([], CATALOG)).toEqual([]);
  });
});

describe("computeRevenueBreakdown", () => {
  it("groups class 7 leaves and excludes production 71/72", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajC: 80000 }),
      makeRow({ cont: "711", contBase: "711", rulajC: 50000 }),
      makeRow({ cont: "722", contBase: "722", rulajC: 30000 }),
      makeRow({ cont: "766", contBase: "766", rulajC: 500 }),
    ];

    const result = computeRevenueBreakdown(rows, CATALOG);
    const codes = result.map((r) => r.code);
    expect(codes).toContain("70");
    expect(codes).toContain("76");
    expect(codes).not.toContain("71");
    expect(codes).not.toContain("72");
  });

  it("709 is contra-revenue (subtracts rulajD)", () => {
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajC: 100000 }),
      makeRow({ cont: "709", contBase: "709", rulajD: 15000 }),
    ];

    const result = computeRevenueBreakdown(rows, CATALOG);
    const c70 = result.find((r) => r.code === "70");
    expect(c70?.value).toBe(85000);
  });

  it("returns empty array when no revenues", () => {
    expect(computeRevenueBreakdown([], CATALOG)).toEqual([]);
  });
});

describe("computeTopMonthlyExpenses", () => {
  it("returns top N leaves of class 6 by rulajD desc with percent share", () => {
    const rows = [
      makeRow({ cont: "641.A", contBase: "641", rulajD: 50000, denumire: "Salarii brut" }),
      makeRow({ cont: "628.B", contBase: "628", rulajD: 12000, denumire: "Servicii IT" }),
      makeRow({ cont: "605.C", contBase: "605", rulajD: 8000, denumire: "Energie" }),
      makeRow({ cont: "611.D", contBase: "611", rulajD: 0 }),
    ];

    const result = computeTopMonthlyExpenses(rows, CATALOG, 10);
    expect(result).toHaveLength(3);
    expect(result[0].denumire).toBe("Salarii brut");
    expect(result[0].value).toBe(50000);
    expect(result[0].percent).toBeCloseTo((50000 / 70000) * 100, 1);
  });

  it("respects the limit parameter", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRow({ cont: `605.${i}`, contBase: "605", rulajD: 1000 + i, denumire: `e${i}` })
    );
    expect(computeTopMonthlyExpenses(rows, CATALOG, 5)).toHaveLength(5);
  });

  it("excludes 609 contra-expense from top list", () => {
    const rows = [
      makeRow({ cont: "605", contBase: "605", rulajD: 10000, denumire: "Marfa" }),
      makeRow({ cont: "609", contBase: "609", rulajC: 99999, denumire: "Reduceri" }),
    ];
    const result = computeTopMonthlyExpenses(rows, CATALOG);
    expect(result).toHaveLength(1);
    expect(result[0].cont).toBe("605");
  });
});

describe("computeRunway", () => {
  const recentTrends = [
    trend(2026, 1, { expenses: 30000 }),
    trend(2026, 2, { expenses: 40000 }),
    trend(2026, 3, { expenses: 50000 }),
  ];

  it("computes months remaining at avg burn of last 3 months", () => {
    const result = computeRunway(
      summary({ soldConturiBancare: 120000, soldRegistruCasa: 0 }),
      recentTrends,
      3
    );
    // avg burn = 40000, cash = 120000 → 3 months
    expect(result.monthlyBurnRate).toBe(40000);
    expect(result.monthsRemaining).toBe(3);
    expect(result.status).toBe("tight");
  });

  it("status = comfortable when >= 6 months", () => {
    const result = computeRunway(
      summary({ soldConturiBancare: 300000 }),
      recentTrends
    );
    expect(result.status).toBe("comfortable");
  });

  it("status = critical when < 3 months or cash <= 0", () => {
    const tight = computeRunway(
      summary({ soldConturiBancare: 50000 }),
      recentTrends
    );
    expect(tight.status).toBe("critical");

    const broke = computeRunway(
      summary({ soldConturiBancare: -100 }),
      recentTrends
    );
    expect(broke.status).toBe("critical");
  });

  it("status = unknown when no trend data", () => {
    const result = computeRunway(summary({ soldConturiBancare: 100000 }), []);
    expect(result.status).toBe("unknown");
    expect(result.monthsRemaining).toBe(0);
  });

  it("ignores trends with zero expenses (avoids dividing by stale months)", () => {
    const mixed = [
      trend(2026, 1, { expenses: 0 }),
      trend(2026, 2, { expenses: 0 }),
      trend(2026, 3, { expenses: 40000 }),
    ];
    const result = computeRunway(summary({ soldConturiBancare: 80000 }), mixed, 3);
    expect(result.monthlyBurnRate).toBe(40000);
    expect(result.monthsRemaining).toBe(2);
  });
});

describe("computeSalaryAffordability", () => {
  it("sums class 64 rulajD and computes months covered", () => {
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 30000 }),
      makeRow({ cont: "645", contBase: "645", rulajD: 10000 }),
      makeRow({ cont: "605", contBase: "605", rulajD: 99999 }),
    ];

    const result = computeSalaryAffordability(rows, CATALOG, 120000);
    expect(result.monthlyPayroll).toBe(40000);
    expect(result.monthsCovered).toBe(3);
    expect(result.status).toBe("comfortable");
  });

  it("status = no_payroll when class 64 is empty", () => {
    const result = computeSalaryAffordability(
      [makeRow({ cont: "605", contBase: "605", rulajD: 5000 })],
      CATALOG,
      100000
    );
    expect(result.status).toBe("no_payroll");
    expect(result.monthlyPayroll).toBe(0);
  });

  it("status = tight when 1-3 months", () => {
    const rows = [makeRow({ cont: "641", contBase: "641", rulajD: 50000 })];
    const result = computeSalaryAffordability(rows, CATALOG, 100000);
    expect(result.monthsCovered).toBe(2);
    expect(result.status).toBe("tight");
  });

  it("status = critical when cash < monthly payroll", () => {
    const rows = [makeRow({ cont: "641", contBase: "641", rulajD: 50000 })];
    const result = computeSalaryAffordability(rows, CATALOG, 20000);
    expect(result.status).toBe("critical");
  });
});

describe("computeYoy", () => {
  it("computes delta vs same month last year when present", () => {
    const trends = [
      trend(2025, 4, { revenue: 80000, expenses: 60000, profit: 20000, cashEnd: 50000 }),
      trend(2026, 4, { revenue: 100000, expenses: 70000, profit: 30000, cashEnd: 80000 }),
    ];
    const result = computeYoy(
      trends,
      2026,
      4,
      summary({
        cifraAfaceriLuna: 100000,
        cheltuieliLuna: 70000,
        soldConturiBancare: 80000,
      })
    );

    expect(result.hasPreviousYear).toBe(true);
    expect(result.revenue.previous).toBe(80000);
    expect(result.revenue.delta).toBe(20000);
    expect(result.revenue.deltaPct).toBeCloseTo(25, 1);
    expect(result.profit.delta).toBe(10000);
  });

  it("hasPreviousYear = false when no matching point", () => {
    const result = computeYoy(
      [trend(2026, 4, { revenue: 100 })],
      2026,
      4,
      summary()
    );
    expect(result.hasPreviousYear).toBe(false);
  });

  it("deltaPct = null when previous was zero", () => {
    const trends = [
      trend(2025, 4, { revenue: 0 }),
      trend(2026, 4, { revenue: 50000 }),
    ];
    const result = computeYoy(
      trends,
      2026,
      4,
      summary({ cifraAfaceriLuna: 50000 })
    );
    expect(result.revenue.previous).toBe(0);
    expect(result.revenue.delta).toBe(50000);
    expect(result.revenue.deltaPct).toBe(null);
  });
});
