import { describe, it, expect } from "vitest";
import {
  aggregateCppByLine,
  computeTrendPoints,
  computeConcentration,
  type PeriodFigures,
} from "@/modules/costi/analysis";
import type { CppData, CppLine, KpiSnapshot } from "@/modules/reporting";

function kpis(overrides: Partial<KpiSnapshot> = {}): KpiSnapshot {
  return {
    cashBank: 0,
    clientiCreante: 0,
    furnizoriDatorii: 0,
    tvaDePlata: 0,
    rezultat: 0,
    totalVenituri: 0,
    totalCheltuieli: 0,
    marjaOperationala: null,
    ...overrides,
  };
}

function line(overrides: Partial<CppLine>): CppLine {
  return {
    cont: "",
    denumire: "",
    indent: 0,
    isHeader: false,
    isTotal: false,
    value: 0,
    ...overrides,
  };
}

function cpp(overrides: Partial<CppData> = {}): CppData {
  return {
    lines: [],
    venituriExploatare: 0,
    cheltuieliExploatare: 0,
    rezultatExploatare: 0,
    venituriFinanciare: 0,
    cheltuieliFinanciare: 0,
    rezultatFinanciar: 0,
    rezultatBrut: 0,
    rezultatNet: 0,
    ...overrides,
  };
}

describe("aggregateCppByLine", () => {
  const verticals = [
    { id: "v1", name: "Outsourcing", isDefault: false },
    { id: "v2", name: "Coworking", isDefault: false },
  ];

  it("buckets detail rows under the current section header", () => {
    const data = cpp({
      verticals,
      lines: [
        line({ denumire: "VENITURI DIN EXPLOATARE", isHeader: true }),
        line({ cont: "704", value: 100, byVertical: { v1: 60, v2: 40 } }),
        line({ denumire: "CHELTUIELI DE EXPLOATARE", isHeader: true }),
        line({ cont: "628", value: 30, byVertical: { v1: 30 } }),
        line({ denumire: "REZULTAT DIN EXPLOATARE", isTotal: true, value: 70 }),
        line({ cont: "691", value: 10, byVertical: { v1: 10 } }),
      ],
    });
    const { venituri, cheltuieli } = aggregateCppByLine(data);
    expect(venituri).toEqual({ v1: 60, v2: 40 });
    // Tax line after the first REZULTAT total must NOT count.
    expect(cheltuieli).toEqual({ v1: 30 });
  });

  it("skips totals and rows without byVertical", () => {
    const data = cpp({
      lines: [
        line({ denumire: "VENITURI DIN EXPLOATARE", isHeader: true }),
        line({ cont: "TOTAL", isTotal: true, value: 100, byVertical: { v1: 100 } }),
        line({ cont: "704", value: 100 }),
      ],
    });
    expect(aggregateCppByLine(data)).toEqual({ venituri: {}, cheltuieli: {} });
  });
});

describe("computeTrendPoints", () => {
  it("derives monthly flows from consecutive YTD snapshots", () => {
    const figures: PeriodFigures[] = [
      {
        year: 2026,
        month: 1,
        kpis: kpis({ cashBank: 500 }),
        cpp: cpp({ venituriExploatare: 100, cheltuieliExploatare: 60 }),
      },
      {
        year: 2026,
        month: 2,
        kpis: kpis({ cashBank: 700 }),
        cpp: cpp({ venituriExploatare: 250, cheltuieliExploatare: 150 }),
      },
    ];
    const points = computeTrendPoints(figures);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({
      year: 2026,
      month: 1,
      venituri: 100,
      cheltuieli: 60,
      rezultatBrut: 40,
      marjaPct: 40,
      cash: 500,
      monthsCovered: 1,
    });
    expect(points[1]).toMatchObject({
      venituri: 150,
      cheltuieli: 90,
      rezultatBrut: 60,
      marjaPct: 40,
      cash: 700,
      monthsCovered: 1,
    });
  });

  it("resets the baseline at fiscal-year boundaries", () => {
    const figures: PeriodFigures[] = [
      { year: 2025, month: 12, kpis: null, cpp: cpp({ venituriExploatare: 1200 }) },
      { year: 2026, month: 1, kpis: null, cpp: cpp({ venituriExploatare: 90 }) },
    ];
    const points = computeTrendPoints(figures);
    expect(points[1].venituri).toBe(90);
    expect(points[1].monthsCovered).toBe(1);
  });

  it("spans journal gaps and reports monthsCovered > 1", () => {
    const figures: PeriodFigures[] = [
      { year: 2026, month: 2, kpis: null, cpp: cpp({ venituriExploatare: 200 }) },
      { year: 2026, month: 5, kpis: null, cpp: cpp({ venituriExploatare: 500 }) },
    ];
    const points = computeTrendPoints(figures);
    expect(points[1].venituri).toBe(300);
    expect(points[1].monthsCovered).toBe(3);
  });

  it("includes both financial and operating figures in the flows", () => {
    const figures: PeriodFigures[] = [
      {
        year: 2026,
        month: 3,
        kpis: null,
        cpp: cpp({
          venituriExploatare: 100,
          venituriFinanciare: 20,
          cheltuieliExploatare: 50,
          cheltuieliFinanciare: 10,
        }),
      },
    ];
    const [p] = computeTrendPoints(figures);
    expect(p.venituri).toBe(120);
    expect(p.cheltuieli).toBe(60);
    expect(p.rezultatBrut).toBe(60);
    // First snapshot of the year covers January -> March.
    expect(p.monthsCovered).toBe(3);
  });

  it("reports null marja when venituri is zero and skips null-cpp periods", () => {
    const figures: PeriodFigures[] = [
      { year: 2026, month: 1, kpis: null, cpp: null },
      { year: 2026, month: 2, kpis: null, cpp: cpp({ cheltuieliExploatare: 40 }) },
    ];
    const points = computeTrendPoints(figures);
    expect(points).toHaveLength(1);
    expect(points[0].marjaPct).toBeNull();
    expect(points[0].rezultatBrut).toBe(-40);
  });

  it("computes per-line monthly deltas keyed by line name", () => {
    const verticals = [
      { id: "v1", name: "Outsourcing", isDefault: false },
      { id: "v2", name: "Toata firma", isDefault: true },
    ];
    const mk = (revV1: number, revV2: number, exp: number) =>
      cpp({
        verticals,
        venituriExploatare: revV1 + revV2,
        cheltuieliExploatare: exp,
        lines: [
          line({ denumire: "VENITURI DIN EXPLOATARE", isHeader: true }),
          line({ cont: "704", value: revV1 + revV2, byVertical: { v1: revV1, v2: revV2 } }),
          line({ denumire: "CHELTUIELI DE EXPLOATARE", isHeader: true }),
          line({ cont: "628", value: exp, byVertical: { v2: exp } }),
        ],
      });
    const figures: PeriodFigures[] = [
      { year: 2026, month: 1, kpis: null, cpp: mk(100, 50, 30) },
      { year: 2026, month: 2, kpis: null, cpp: mk(180, 90, 70) },
    ];
    const points = computeTrendPoints(figures, true);
    expect(points[0].byLine).toEqual({
      Outsourcing: { venituri: 100, cheltuieli: 0, rezultat: 100 },
      "Toata firma": { venituri: 50, cheltuieli: 30, rezultat: 20 },
    });
    expect(points[1].byLine).toEqual({
      Outsourcing: { venituri: 80, cheltuieli: 0, rezultat: 80 },
      "Toata firma": { venituri: 40, cheltuieli: 40, rezultat: 0 },
    });
  });

  it("sorts unordered input by period", () => {
    const figures: PeriodFigures[] = [
      { year: 2026, month: 2, kpis: null, cpp: cpp({ venituriExploatare: 250 }) },
      { year: 2026, month: 1, kpis: null, cpp: cpp({ venituriExploatare: 100 }) },
    ];
    const points = computeTrendPoints(figures);
    expect(points.map((p) => p.month)).toEqual([1, 2]);
    expect(points[1].venituri).toBe(150);
  });
});

describe("computeConcentration", () => {
  it("computes top1/top3/top5 shares of the given total", () => {
    const c = computeConcentration([50, 20, 10, 5, 5, 5, 5], 100);
    expect(c).toEqual({ top1Pct: 50, top3Pct: 80, top5Pct: 90 });
  });

  it("sorts by absolute value before slicing", () => {
    const c = computeConcentration([10, -80, 5], 100);
    expect(c!.top1Pct).toBe(80);
  });

  it("returns null for a zero total", () => {
    expect(computeConcentration([10], 0)).toBeNull();
  });

  it("handles fewer contributors than the bucket size", () => {
    const c = computeConcentration([60], 100);
    expect(c).toEqual({ top1Pct: 60, top3Pct: 60, top5Pct: 60 });
  });
});
