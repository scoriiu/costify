import { describe, it, expect } from "vitest";
import { makeBalanceRow } from "../../../fixtures/balance-rows";
import {
  industryFromCaen,
  resolveIndustry,
  extractKpiBaseInputs,
  computeIndustryKpis,
  kpiState,
  KPI_REGISTRY,
  INDUSTRY_PROFILES,
  INPUT_SOURCES,
  GROUP_INFO,
} from "@/modules/reporting/industry";
import type { CatalogAccount } from "@/modules/accounts";

const emptyCatalog = new Map<string, CatalogAccount>();

function catalogWith(entries: Array<[string, Partial<CatalogAccount>]>): Map<string, CatalogAccount> {
  const m = new Map<string, CatalogAccount>();
  for (const [cont, flags] of entries) {
    m.set(cont, { cont, ...flags } as CatalogAccount);
  }
  return m;
}

/* -------------------------------------------------------------------------- */
/*                            CAEN DETECTION                                  */
/* -------------------------------------------------------------------------- */

describe("industryFromCaen", () => {
  it("maps retail divisions 45/46/47", () => {
    expect(industryFromCaen("4711")).toBe("retail");
    expect(industryFromCaen("45")).toBe("retail");
    expect(industryFromCaen("4690")).toBe("retail");
  });

  it("maps telecom 61 and banking 64-66", () => {
    expect(industryFromCaen("6110")).toBe("telecom");
    expect(industryFromCaen("6419")).toBe("banking");
    expect(industryFromCaen("6512")).toBe("banking");
    expect(industryFromCaen("6622")).toBe("banking");
  });

  it("maps 6920 to servicii_contabile but 69.10 (legal) to consultanta", () => {
    expect(industryFromCaen("6920")).toBe("servicii_contabile");
    expect(industryFromCaen("69.20")).toBe("servicii_contabile");
    expect(industryFromCaen("6910")).toBe("consultanta");
  });

  it("maps IT and professional services to consultanta", () => {
    expect(industryFromCaen("6201")).toBe("consultanta");
    expect(industryFromCaen("7022")).toBe("consultanta");
    expect(industryFromCaen("7311")).toBe("consultanta");
  });

  it("handles dots, partial codes and unknowns", () => {
    expect(industryFromCaen("47.11")).toBe("retail");
    expect(industryFromCaen("47")).toBe("retail");
    expect(industryFromCaen("01")).toBeNull();
    expect(industryFromCaen("")).toBeNull();
    expect(industryFromCaen(null)).toBeNull();
    expect(industryFromCaen("x")).toBeNull();
  });
});

describe("resolveIndustry", () => {
  it("manual selection wins over caen", () => {
    expect(
      resolveIndustry({ industry: "telecom", industrySource: "manual", caen: "4711" })
    ).toEqual({ id: "telecom", source: "manual" });
  });

  it("stored auto value wins over re-deriving", () => {
    expect(
      resolveIndustry({ industry: "retail", industrySource: "auto", caen: "6201" })
    ).toEqual({ id: "retail", source: "auto" });
  });

  it("derives from caen when nothing stored", () => {
    expect(
      resolveIndustry({ industry: null, industrySource: null, caen: "6920" })
    ).toEqual({ id: "servicii_contabile", source: "auto" });
  });

  it("falls back to general", () => {
    expect(
      resolveIndustry({ industry: null, industrySource: null, caen: null })
    ).toEqual({ id: "general", source: "default" });
    expect(
      resolveIndustry({ industry: "bogus", industrySource: "manual", caen: null })
    ).toEqual({ id: "general", source: "default" });
  });
});

/* -------------------------------------------------------------------------- */
/*                          INPUT EXTRACTION                                  */
/* -------------------------------------------------------------------------- */

// A small but complete trial balance: 6 months elapsed.
// P&L (YTD): CA 600.000 (704), reduceri 709 = 10.000 -> CA 590.000
//   venituri dobanzi 766 = 2.000 -> venituri totale 592.000
//   cheltuieli: 607 COGS 300.000, 641 salarii 120.000, 612 chirii 30.000,
//   681 amortizare 24.000, 666 dobanzi 6.000 -> total 480.000
//   691 impozit 16.000 (flagged isProfitTax)
// Balance: 411 sold D 90.000, 401 sold C 60.000, 371 stoc 50.000,
//   5121 cash 80.000, 1621 credit LT 100.000, 5191 credit ST 20.000,
//   101 capital 10.000, 121 profit C 96.000, TVA 4423 C 15.000
function fixtureRows() {
  return [
    makeBalanceRow({ cont: "704", contBase: "704", totalCred: 600000 }),
    makeBalanceRow({ cont: "709", contBase: "709", totalDeb: 10000 }),
    makeBalanceRow({ cont: "766", contBase: "766", totalCred: 2000 }),
    makeBalanceRow({ cont: "607", contBase: "607", totalDeb: 300000 }),
    makeBalanceRow({ cont: "641", contBase: "641", totalDeb: 120000 }),
    makeBalanceRow({ cont: "612", contBase: "612", totalDeb: 30000 }),
    makeBalanceRow({ cont: "6811", contBase: "681", totalDeb: 24000 }),
    makeBalanceRow({ cont: "666", contBase: "666", totalDeb: 6000 }),
    makeBalanceRow({ cont: "691", contBase: "691", totalDeb: 16000 }),
    makeBalanceRow({ cont: "411.C1", contBase: "411", finD: 50000, totalCred: 500000 }),
    makeBalanceRow({ cont: "411.C2", contBase: "411", finD: 30000, totalCred: 300000 }),
    makeBalanceRow({ cont: "411.C3", contBase: "411", finD: 10000, totalCred: 150000 }),
    makeBalanceRow({ cont: "411.C4", contBase: "411", finD: 0, totalCred: 50000 }),
    makeBalanceRow({ cont: "401.F1", contBase: "401", finC: 60000 }),
    makeBalanceRow({ cont: "371", contBase: "371", finD: 50000 }),
    makeBalanceRow({ cont: "5121", contBase: "512", finD: 80000 }),
    makeBalanceRow({ cont: "1621", contBase: "162", finC: 100000 }),
    makeBalanceRow({ cont: "5191", contBase: "519", finC: 20000 }),
    makeBalanceRow({ cont: "101", contBase: "101", finC: 10000 }),
    makeBalanceRow({ cont: "121", contBase: "121", finC: 96000 }),
    makeBalanceRow({ cont: "4423", contBase: "4423", finC: 15000 }),
  ];
}

const fixtureCatalog = catalogWith([["691", { isProfitTax: true }]]);

describe("extractKpiBaseInputs", () => {
  const inputs = extractKpiBaseInputs(fixtureRows(), fixtureCatalog, 6);

  it("computes P&L aggregates with 709/609 contra and profit-tax exclusion", () => {
    expect(inputs.cifraAfaceri).toBe(590000);
    expect(inputs.venituriTotale).toBe(592000);
    expect(inputs.cheltuieliTotale).toBe(480000);
    expect(inputs.cogs).toBe(300000);
    expect(inputs.amortizare).toBe(24000);
    expect(inputs.cheltuieliDobanzi).toBe(6000);
    expect(inputs.venituriDobanzi).toBe(2000);
    expect(inputs.cheltuieliPersonal).toBe(120000);
    expect(inputs.chirii).toBe(30000);
    expect(inputs.impozitProfit).toBe(16000);
  });

  it("derives rezultat, EBIT, EBITDA", () => {
    expect(inputs.rezultatBrut).toBe(112000); // 592.000 - 480.000
    expect(inputs.profitNet).toBe(96000); // - 16.000 impozit
    expect(inputs.ebit).toBe(116000); // 112.000 + 6.000 - 2.000
    expect(inputs.ebitda).toBe(140000); // + 24.000
  });

  it("computes balance-sheet aggregates", () => {
    expect(inputs.creanteClienti).toBe(90000);
    expect(inputs.furnizori).toBe(60000);
    expect(inputs.stocuri).toBe(50000);
    expect(inputs.cash).toBe(80000);
    expect(inputs.activeCurente).toBe(220000); // 80k cash + 90k creante + 50k stoc
    expect(inputs.datoriiCurente).toBe(95000); // 60k furnizori + 15k TVA + 20k 519
    expect(inputs.datoriiTermenLung).toBe(100000);
    expect(inputs.datoriiFinanciare).toBe(120000); // 162 + 519
    expect(inputs.capitalPropriu).toBe(106000); // 101 + 121
    expect(inputs.totalActiv).toBe(220000); // no imobilizari in fixture
  });

  it("computes top-3 client concentration from 411 analytics", () => {
    // top3 = 500k+300k+150k = 950k of 1.000k total = 95%
    expect(inputs.top3ClientiPercent).toBe(95);
  });

  it("computes prior-year CA when prev rows provided", () => {
    const prev = [makeBalanceRow({ cont: "704", contBase: "704", totalCred: 500000 })];
    const withPrev = extractKpiBaseInputs(fixtureRows(), fixtureCatalog, 6, prev);
    expect(withPrev.cifraAfaceriAnPrecedent).toBe(500000);
  });

  it("ignores extra-bilantier and non-leaf rows", () => {
    const rows = [
      ...fixtureRows(),
      makeBalanceRow({ cont: "8033", contBase: "8033", totalCred: 999999, isExtraBilantier: true }),
      makeBalanceRow({ cont: "70", contBase: "70", totalCred: 999999, isLeaf: false }),
    ];
    const i2 = extractKpiBaseInputs(rows, fixtureCatalog, 6);
    expect(i2.cifraAfaceri).toBe(590000);
  });

  it("every input id has an audit-trail source description", () => {
    for (const key of Object.keys(inputs)) {
      if (key === "monthsElapsed") continue;
      expect(INPUT_SOURCES[key as keyof typeof INPUT_SOURCES], key).toBeDefined();
      expect(INPUT_SOURCES[key as keyof typeof INPUT_SOURCES].source.length).toBeGreaterThan(10);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                            KPI FORMULAS                                    */
/* -------------------------------------------------------------------------- */

describe("KPI formulas", () => {
  const section = computeIndustryKpis(fixtureRows(), fixtureCatalog, {
    industry: "general",
    industrySource: "default",
    caen: null,
    year: 2026,
    month: 6,
  });
  const all = section.groups.flatMap((g) => g.kpis);
  const byId = (id: string) => {
    const k = all.find((x) => x.id === id);
    expect(k, `KPI ${id} missing`).toBeDefined();
    return k!;
  };

  it("marja bruta = (CA - COGS) / CA", () => {
    const k = byId("marjaBruta");
    expect(k.value).toBeCloseTo(((590000 - 300000) / 590000) * 100, 1);
    expect(k.calculation).toContain("590.000");
    expect(k.calculation).toContain("300.000");
  });

  it("marja EBITDA and marja neta", () => {
    expect(byId("marjaEbitda").value).toBeCloseTo((140000 / 592000) * 100, 1);
    expect(byId("marjaNeta").value).toBeCloseTo((96000 / 592000) * 100, 1);
  });

  it("ROE annualizes YTD profit (6 months -> x2)", () => {
    const k = byId("roe");
    expect(k.value).toBeCloseTo(((96000 * 2) / 106000) * 100, 0);
    expect(k.calculation).toContain("× 12");
  });

  it("liquidity ratios", () => {
    expect(byId("currentRatio").value).toBeCloseTo(220000 / 95000, 2);
    expect(byId("quickRatio").value).toBeCloseTo((220000 - 50000) / 95000, 2);
    expect(byId("cashRatio").value).toBeCloseTo(80000 / 95000, 2);
    expect(byId("workingCapital").value).toBe(125000);
  });

  it("DSO/DPO/DIO use annualized denominators", () => {
    const caA = (590000 / 6) * 12;
    const cogsA = (300000 / 6) * 12;
    expect(byId("dso").value).toBeCloseTo(90000 / (caA / 365), 1);
    expect(byId("dpo").value).toBeCloseTo(60000 / (cogsA / 365), 1);
    expect(byId("dio").value).toBeCloseTo(50000 / (cogsA / 365), 1);
  });

  it("CCC = DSO + DIO - DPO", () => {
    const dso = byId("dso").value!;
    const dpo = byId("dpo").value!;
    const dio = byId("dio").value!;
    expect(byId("ccc").value).toBeCloseTo(dso + dio - dpo, 1);
  });

  it("indebtedness ratios", () => {
    expect(byId("debtToEquity").value).toBeCloseTo(195000 / 106000, 2);
    expect(byId("gradIndatorare").value).toBeCloseTo((195000 / 220000) * 100, 1);
    expect(byId("interestCoverage").value).toBeCloseTo(116000 / 6000, 2);
    // net debt = 120.000 - 80.000 = 40.000; ebitda anual = 280.000
    expect(byId("debtToEbitda").value).toBeCloseTo(40000 / 280000, 2);
  });

  it("revenue growth null without prior year, computed with it", () => {
    expect(byId("revenueGrowth").value).toBeNull();
    expect(byId("revenueGrowth").unavailableReason).toBeTruthy();

    const withPrev = computeIndustryKpis(fixtureRows(), fixtureCatalog, {
      industry: "general",
      industrySource: "default",
      caen: null,
      year: 2026,
      month: 6,
      prevYearRows: [makeBalanceRow({ cont: "704", contBase: "704", totalCred: 500000 })],
    });
    const g = withPrev.groups.flatMap((x) => x.kpis).find((x) => x.id === "revenueGrowth")!;
    expect(g.value).toBeCloseTo((590000 / 500000 - 1) * 100, 1);
  });

  it("cost personal percent", () => {
    expect(byId("costPersonal").value).toBeCloseTo((120000 / 592000) * 100, 1);
  });

  it("every computed KPI carries inputs trace and calculation string", () => {
    for (const k of all) {
      if (k.value === null) continue;
      expect(k.calculation, k.id).toBeTruthy();
      if (k.id !== "top3Concentration") {
        expect(k.inputs.length, k.id).toBeGreaterThan(0);
        for (const inp of k.inputs) {
          expect(inp.source.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("every KPI has both languages and they differ", () => {
    for (const def of KPI_REGISTRY) {
      expect(def.labelContabil.length).toBeGreaterThan(3);
      expect(def.labelAntreprenor.length).toBeGreaterThan(3);
      expect(def.labelAntreprenor).not.toBe(def.labelContabil);
      expect(def.formulaContabil).not.toBe(def.formulaAntreprenor);
      expect(def.interpretationContabil.length).toBeGreaterThan(10);
      expect(def.interpretationAntreprenor.length).toBeGreaterThan(10);
    }
  });

  it("no em dash and no diacritics-free violations in user-facing strings", () => {
    for (const def of KPI_REGISTRY) {
      for (const s of [def.labelContabil, def.labelAntreprenor, def.interpretationContabil, def.interpretationAntreprenor]) {
        expect(s.includes("—"), `${def.id}: ${s}`).toBe(false);
      }
    }
    for (const g of Object.values(GROUP_INFO)) {
      expect(g.contabil.includes("—")).toBe(false);
      expect(g.antreprenor.includes("—")).toBe(false);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                          STATES & PROFILES                                 */
/* -------------------------------------------------------------------------- */

describe("kpiState", () => {
  const higher = { target: 30, alarm: 20, direction: "higher" as const, label: "> 30%" };
  const lower = { target: 45, alarm: 90, direction: "lower" as const, label: "< 45" };

  it("higher direction", () => {
    expect(kpiState(35, higher)).toBe("good");
    expect(kpiState(30, higher)).toBe("good");
    expect(kpiState(25, higher)).toBe("warn");
    expect(kpiState(20, higher)).toBe("danger");
    expect(kpiState(10, higher)).toBe("danger");
  });

  it("lower direction", () => {
    expect(kpiState(40, lower)).toBe("good");
    expect(kpiState(60, lower)).toBe("warn");
    expect(kpiState(95, lower)).toBe("danger");
  });

  it("null and missing thresholds", () => {
    expect(kpiState(null, higher)).toBe("unknown");
    expect(kpiState(50, null)).toBe("neutral");
  });
});

describe("industry profiles", () => {
  it("every profile references only existing KPI ids", () => {
    const ids = new Set(KPI_REGISTRY.map((k) => k.id));
    for (const profile of Object.values(INDUSTRY_PROFILES)) {
      for (const id of profile.industryKpiIds) {
        expect(ids.has(id), `${profile.id}: ${id}`).toBe(true);
      }
      for (const id of Object.keys(profile.thresholdOverrides)) {
        expect(ids.has(id), `${profile.id} override: ${id}`).toBe(true);
      }
    }
  });

  it("retail profile overrides cost personal band to 18%", () => {
    const section = computeIndustryKpis(fixtureRows(), fixtureCatalog, {
      industry: "retail",
      industrySource: "manual",
      caen: "4711",
      year: 2026,
      month: 6,
    });
    const cp = section.groups.flatMap((g) => g.kpis).find((k) => k.id === "costPersonal")!;
    expect(cp.thresholds?.target).toBe(18);
    // 20.3% with retail band (target 18, alarm 25) -> warn
    expect(cp.state).toBe("warn");
    // industry group contains retail drivers
    const ind = section.groups.find((g) => g.id === "industrie")!;
    expect(ind.kpis.map((k) => k.id)).toContain("rotatieStocuri");
    expect(ind.kpis.map((k) => k.id)).toContain("chirieVanzari");
    expect(ind.descriptionAntreprenor.length).toBeGreaterThan(20);
  });

  it("consultanta keeps cost personal good under 55%", () => {
    const section = computeIndustryKpis(fixtureRows(), fixtureCatalog, {
      industry: "consultanta",
      industrySource: "auto",
      caen: "6201",
      year: 2026,
      month: 6,
    });
    const cp = section.groups.flatMap((g) => g.kpis).find((k) => k.id === "costPersonal")!;
    expect(cp.thresholds?.target).toBe(55);
    expect(cp.state).toBe("good"); // 20.3% < 55%
  });

  it("operational KPIs render as unavailable with reason, never fake values", () => {
    const section = computeIndustryKpis(fixtureRows(), fixtureCatalog, {
      industry: "telecom",
      industrySource: "manual",
      caen: "6110",
      year: 2026,
      month: 6,
    });
    const ind = section.groups.find((g) => g.id === "industrie")!;
    const mrr = ind.kpis.find((k) => k.id === "mrr")!;
    expect(mrr.value).toBeNull();
    expect(mrr.state).toBe("unknown");
    expect(mrr.unavailableReason).toContain("date operationale");
    // capex intensity IS computable
    const capex = ind.kpis.find((k) => k.id === "capexIntensity")!;
    expect(capex.value).toBe(0); // no imobilizari rulaj in fixture
  });

  it("every group has explainers for both audiences", () => {
    const section = computeIndustryKpis(fixtureRows(), fixtureCatalog, {
      industry: "servicii_contabile",
      industrySource: "manual",
      caen: "6920",
      year: 2026,
      month: 6,
    });
    for (const g of section.groups) {
      expect(g.descriptionContabil.length, g.id).toBeGreaterThan(20);
      expect(g.descriptionAntreprenor.length, g.id).toBeGreaterThan(20);
    }
  });
});
