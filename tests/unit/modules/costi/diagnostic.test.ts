import { describe, it, expect } from "vitest";
import {
  computeDiagnostic,
  isException,
  type DiagnosticInputs,
  type TrendPoint,
} from "@/modules/costi/analysis";
import type { KpiSnapshot } from "@/modules/reporting";

function kpis(overrides: Partial<KpiSnapshot> = {}): KpiSnapshot {
  return {
    cashBank: 100_000,
    clientiCreante: 50_000,
    furnizoriDatorii: 20_000,
    tvaDePlata: 5_000,
    rezultat: 60_000,
    totalVenituri: 600_000,
    totalCheltuieli: 540_000,
    marjaOperationala: 10,
    ...overrides,
  };
}

function point(
  month: number,
  venituri: number,
  cheltuieli: number,
  cash: number | null = 100_000,
  year = 2026
): TrendPoint {
  const rezultatBrut = venituri - cheltuieli;
  return {
    year,
    month,
    venituri,
    cheltuieli,
    rezultatBrut,
    marjaPct: venituri !== 0 ? (rezultatBrut / venituri) * 100 : null,
    cash,
    monthsCovered: 1,
  };
}

function baseInputs(overrides: Partial<DiagnosticInputs> = {}): DiagnosticInputs {
  return {
    latest: { year: 2026, month: 6 },
    kpis: kpis(),
    trend: [1, 2, 3, 4, 5, 6].map((m) => point(m, 100_000, 90_000)),
    topPartners: [{ name: "Acme SRL", rulaj: 90_000, pct: 15 }],
    unmapped: { count: 0, rulaj: 0 },
    defaultLineShare: null,
    employee: null,
    ...overrides,
  };
}

function flagIds(inputs: DiagnosticInputs): string[] {
  return computeDiagnostic(inputs).flags.map((f) => f.id);
}

describe("isException (response-contract rule)", () => {
  it("requires BOTH relative >10% and absolute > max(1000, 0.5% YTD)", () => {
    expect(isException(15_000, 100_000, 600_000)).toBe(true);
    expect(isException(9_000, 100_000, 600_000)).toBe(false); // 9% relative
    expect(isException(2_000, 10_000, 600_000)).toBe(false); // 20% but < 3000 abs
    expect(isException(-15_000, 100_000, 600_000)).toBe(true); // symmetric
  });

  it("uses only the absolute floor when the reference is zero", () => {
    expect(isException(5_000, 0, 600_000)).toBe(true);
    expect(isException(500, 0, 600_000)).toBe(false);
  });
});

describe("computeDiagnostic: healthy firm", () => {
  it("produces no alarm flags on stable profitable months", () => {
    const result = computeDiagnostic(baseInputs());
    expect(result.flags.filter((f) => f.severity === "alarma")).toHaveLength(0);
    expect(result.lunaPartialaSuspecta).toBe(false);
    expect(result.marjaTrend).toBe("stabila");
    expect(result.burnLunar).toBe(90_000);
  });
});

describe("computeDiagnostic: individual signals", () => {
  it("flags negative cash as alarm with runway 0", () => {
    const result = computeDiagnostic(baseInputs({ kpis: kpis({ cashBank: -28_000 }) }));
    const flag = result.flags.find((f) => f.id === "cash_negativ");
    expect(flag?.severity).toBe("alarma");
    expect(result.runwayLuni).toBe(0);
    expect(result.flags[0].id).toBe("cash_negativ"); // alarms sort first
  });

  it("flags runway under 3 months as alarm when burning cash", () => {
    const inputs = baseInputs({
      kpis: kpis({ cashBank: 100_000 }),
      trend: [1, 2, 3, 4, 5, 6].map((m) => point(m, 50_000, 100_000)),
    });
    const result = computeDiagnostic(inputs);
    const flag = result.flags.find((f) => f.id === "runway");
    expect(flag?.severity).toBe("alarma");
    expect(result.runwayLuni).toBe(2); // 100k / 50k net burn
  });

  it("does not flag runway for a self-financing firm", () => {
    expect(flagIds(baseInputs())).not.toContain("runway");
  });

  it("names the top partner at 30%+ and escalates past 50%", () => {
    const watch = computeDiagnostic(
      baseInputs({ topPartners: [{ name: "Roche", rulaj: 200_000, pct: 35 }] })
    ).flags.find((f) => f.id === "concentrare");
    expect(watch?.severity).toBe("atentie");
    expect(watch?.text).toContain("Roche");

    const alarm = computeDiagnostic(
      baseInputs({ topPartners: [{ name: "Roche", rulaj: 340_000, pct: 56.5 }] })
    ).flags.find((f) => f.id === "concentrare");
    expect(alarm?.severity).toBe("alarma");
    expect(alarm?.text).toContain("Roche");
    expect(alarm?.text).toContain("56.5%");
  });

  it("fires the honesty check when the default line holds most of the money", () => {
    const flag = computeDiagnostic(
      baseInputs({ defaultLineShare: { venituriPct: 98.5, cheltuieliPct: 97 } })
    ).flags.find((f) => f.id === "linii_nealocate");
    expect(flag?.severity).toBe("atentie");
    expect(flag?.text).toContain("99% din venituri");
    expect(flag?.text).toContain("cosmetizat");
  });

  it("stays silent on well-allocated lines", () => {
    expect(
      flagIds(baseInputs({ defaultLineShare: { venituriPct: 10, cheltuieliPct: 30 } }))
    ).not.toContain("linii_nealocate");
  });

  it("detects a suspect partial month and excludes it from burn", () => {
    const trend = [1, 2, 3, 4, 5].map((m) => point(m, 100_000, 90_000));
    trend.push(point(6, 20_000, 18_000)); // 20% of the 3-month average
    const result = computeDiagnostic(baseInputs({ trend }));
    expect(result.lunaPartialaSuspecta).toBe(true);
    expect(result.flags.find((f) => f.id === "luna_partiala")?.text).toContain("iunie 2026");
    expect(result.burnLunar).toBe(90_000); // month 6 excluded
  });

  it("flags a loss streak of 3+ months as alarm", () => {
    const trend = [
      point(1, 100_000, 90_000),
      point(2, 100_000, 90_000),
      point(3, 100_000, 90_000),
      point(4, 80_000, 100_000),
      point(5, 80_000, 100_000),
      point(6, 80_000, 110_000),
    ];
    const flag = computeDiagnostic(baseInputs({ trend })).flags.find(
      (f) => f.id === "pierderi_consecutive"
    );
    expect(flag?.severity).toBe("alarma");
    expect(flag?.text).toContain("3 luni");
  });

  it("flags falling margin (3-month average vs prior 3)", () => {
    const trend = [
      point(1, 100_000, 80_000), // 20%
      point(2, 100_000, 80_000),
      point(3, 100_000, 80_000),
      point(4, 100_000, 92_000), // 8%
      point(5, 100_000, 92_000),
      point(6, 100_000, 92_000),
    ];
    const result = computeDiagnostic(baseInputs({ trend }));
    expect(result.marjaTrend).toBe("in scadere");
    expect(result.flags.some((f) => f.id === "marja_scade")).toBe(true);
  });

  it("flags receivables above 2 months of invoicing", () => {
    const flag = computeDiagnostic(
      baseInputs({ kpis: kpis({ clientiCreante: 350_000 }) })
    ).flags.find((f) => f.id === "creante_mari");
    expect(flag?.severity).toBe("atentie");
    expect(flag?.text).toContain("3.5 luni");
  });

  it("flags month-over-month exceptions per the contract rule", () => {
    const trend = [1, 2, 3, 4, 5].map((m) => point(m, 100_000, 90_000));
    trend.push(point(6, 150_000, 90_000));
    const ids = flagIds(baseInputs({ trend }));
    expect(ids).toContain("venituri_variatie");
    expect(ids).not.toContain("cheltuieli_variatie");
  });

  it("notes stale employee counts with carry-forward guidance", () => {
    const flag = computeDiagnostic(
      baseInputs({ employee: { count: 28, year: 2026, month: 5, staleMonths: 1 } })
    ).flags.find((f) => f.id === "angajati_neactualizati");
    expect(flag?.severity).toBe("info");
    expect(flag?.text).toContain("mai 2026");
    expect(flag?.text).toContain("ultima valoare");
  });

  it("orders flags by severity: alarms, then watches, then info", () => {
    const result = computeDiagnostic(
      baseInputs({
        kpis: kpis({ cashBank: -1_000, clientiCreante: 500_000 }),
        topPartners: [{ name: "Roche", rulaj: 340_000, pct: 56 }],
        unmapped: { count: 4, rulaj: 12_000 },
      })
    );
    const severities = result.flags.map((f) => f.severity);
    const firstWatch = severities.indexOf("atentie");
    const firstInfo = severities.indexOf("info");
    expect(severities[0]).toBe("alarma");
    expect(firstWatch).toBeGreaterThan(severities.lastIndexOf("alarma"));
    expect(firstInfo).toBeGreaterThan(severities.lastIndexOf("atentie"));
  });
});

describe("computeDiagnostic: degraded inputs", () => {
  it("handles a client with a single period", () => {
    const result = computeDiagnostic(
      baseInputs({ trend: [point(6, 100_000, 90_000)] })
    );
    expect(result.lunaPartialaSuspecta).toBe(false);
    expect(result.marjaTrend).toBeNull();
  });

  it("handles empty partners and missing verticals", () => {
    const result = computeDiagnostic(
      baseInputs({ topPartners: [], defaultLineShare: null, unmapped: null })
    );
    expect(result.flags.every((f) => f.id !== "concentrare")).toBe(true);
  });
});
