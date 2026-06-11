import { describe, it, expect } from "vitest";
import { makeBalanceRow } from "../../../fixtures/balance-rows";
import {
  detectIndustryFromJournal,
  isJournalMismatch,
  computeIndustryKpis,
} from "@/modules/reporting/industry";
import type { CatalogAccount } from "@/modules/accounts";

const emptyCatalog = new Map<string, CatalogAccount>();

describe("detectIndustryFromJournal", () => {
  it("detects comert from dominant 707", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "707", contBase: "707", totalCred: 80000 }),
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 20000 }),
    ]);
    expect(signal).not.toBeNull();
    expect(signal!.activity).toBe("comert");
    expect(signal!.industry).toBe("retail");
    expect(signal!.sharePercent).toBe(80);
    expect(signal!.evidence).toContain("707");
  });

  it("detects comert from 30%+ 707 with 371 stock activity", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "707", contBase: "707", totalCred: 35000 }),
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 65000 }),
      makeBalanceRow({ cont: "371", contBase: "371", totalDeb: 30000, totalCred: 28000 }),
    ]);
    expect(signal!.activity).toBe("comert");
    expect(signal!.evidence).toContain("371");
  });

  it("detects servicii from dominant 704/705/708", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 90000 }),
      makeBalanceRow({ cont: "707", contBase: "707", totalCred: 10000 }),
    ]);
    expect(signal!.activity).toBe("servicii");
    expect(signal!.industry).toBe("consultanta");
  });

  it("detects inchirieri from dominant 706 and maps to the inchirieri profile", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "706", contBase: "706", totalCred: 160000 }),
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 7000 }),
    ]);
    expect(signal!.activity).toBe("inchirieri");
    expect(signal!.industry).toBe("inchirieri");
  });

  it("journal fallback resolves a rental firm to the inchirieri profile", () => {
    const section = computeIndustryKpis(
      [
        makeBalanceRow({ cont: "706", contBase: "706", totalCred: 160000 }),
        makeBalanceRow({ cont: "611", contBase: "611", totalDeb: 12000 }),
        makeBalanceRow({ cont: "212", contBase: "212", finD: 900000, totalDeb: 900000 }),
      ],
      emptyCatalog,
      { industry: "general", industrySource: "default", caen: null, year: 2026, month: 6 }
    );
    expect(section.industry).toBe("inchirieri");
    expect(section.industrySource).toBe("journal");
    const ind = section.groups.find((g) => g.id === "industrie")!;
    const ids = ind.kpis.map((k) => k.id);
    expect(ids).toContain("pondereChirii");
    expect(ids).toContain("randamentImobilizari");
    expect(ids).toContain("intretinereChirii");
    const randament = ind.kpis.find((k) => k.id === "randamentImobilizari")!;
    expect(randament.value).toBeCloseTo(35.6, 1);
  });

  it("detects productie from 701-703", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "701", contBase: "701", totalCred: 70000 }),
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 30000 }),
    ]);
    expect(signal!.activity).toBe("productie");
    expect(signal!.industry).toBeNull();
  });

  it("detects financiar when 766 outweighs operating revenue", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "766", contBase: "766", totalCred: 100000 }),
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 20000 }),
    ]);
    expect(signal!.activity).toBe("financiar");
    expect(signal!.industry).toBe("banking");
  });

  it("returns null for thin journals (below revenue floor)", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 1000 }),
    ]);
    expect(signal).toBeNull();
  });

  it("returns null for mixed inconclusive revenue", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 40000 }),
      makeBalanceRow({ cont: "707", contBase: "707", totalCred: 30000 }),
      makeBalanceRow({ cont: "701", contBase: "701", totalCred: 30000 }),
    ]);
    expect(signal).toBeNull();
  });

  it("ignores non-leaf rows and accounts for 709 reductions", () => {
    const signal = detectIndustryFromJournal([
      makeBalanceRow({ cont: "70", contBase: "70", totalCred: 999999, isLeaf: false }),
      makeBalanceRow({ cont: "707", contBase: "707", totalCred: 60000 }),
      makeBalanceRow({ cont: "709", contBase: "709", totalDeb: 5000 }),
      makeBalanceRow({ cont: "704", contBase: "704", totalCred: 40000 }),
    ]);
    expect(signal!.activity).toBe("comert");
  });
});

describe("isJournalMismatch", () => {
  const comert = detectIndustryFromJournal([
    makeBalanceRow({ cont: "707", contBase: "707", totalCred: 90000 }),
    makeBalanceRow({ cont: "371", contBase: "371", totalDeb: 50000 }),
  ])!;
  const servicii = detectIndustryFromJournal([
    makeBalanceRow({ cont: "704", contBase: "704", totalCred: 90000 }),
  ])!;

  it("general accepts any activity", () => {
    expect(isJournalMismatch("general", comert)).toBe(false);
    expect(isJournalMismatch("general", servicii)).toBe(false);
  });

  it("retail matches comert, contradicts servicii", () => {
    expect(isJournalMismatch("retail", comert)).toBe(false);
    expect(isJournalMismatch("retail", servicii)).toBe(true);
  });

  it("service-flavored profiles all accept servicii", () => {
    expect(isJournalMismatch("consultanta", servicii)).toBe(false);
    expect(isJournalMismatch("servicii_contabile", servicii)).toBe(false);
    expect(isJournalMismatch("telecom", servicii)).toBe(false);
    expect(isJournalMismatch("consultanta", comert)).toBe(true);
  });
});

describe("computeIndustryKpis journal integration", () => {
  const comertRows = [
    makeBalanceRow({ cont: "707", contBase: "707", totalCred: 200000 }),
    makeBalanceRow({ cont: "607", contBase: "607", totalDeb: 120000 }),
    makeBalanceRow({ cont: "371", contBase: "371", finD: 30000, totalDeb: 150000, totalCred: 120000 }),
  ];

  it("journal fallback picks retail when no CAEN and no manual", () => {
    const section = computeIndustryKpis(comertRows, emptyCatalog, {
      industry: "general",
      industrySource: "default",
      caen: null,
      year: 2026,
      month: 6,
    });
    expect(section.industry).toBe("retail");
    expect(section.industrySource).toBe("journal");
    expect(section.journalHint?.kind).toBe("fallback");
    expect(section.journalHint?.message).toContain("707");
    const ind = section.groups.find((g) => g.id === "industrie")!;
    expect(ind.kpis.map((k) => k.id)).toContain("rotatieStocuri");
  });

  it("mismatch hint when configured industry contradicts the journal", () => {
    const section = computeIndustryKpis(comertRows, emptyCatalog, {
      industry: "consultanta",
      industrySource: "manual",
      caen: "6201",
      year: 2026,
      month: 6,
    });
    expect(section.industry).toBe("consultanta");
    expect(section.industrySource).toBe("manual");
    expect(section.journalHint?.kind).toBe("mismatch");
    expect(section.journalHint?.message).toContain("comert");
    expect(section.journalHint?.message).toContain("Setari");
  });

  it("no hint when journal agrees with configuration", () => {
    const section = computeIndustryKpis(comertRows, emptyCatalog, {
      industry: "retail",
      industrySource: "auto",
      caen: "4711",
      year: 2026,
      month: 6,
    });
    expect(section.journalHint).toBeNull();
  });

  it("inconclusive journal leaves default resolution untouched", () => {
    const thinRows = [makeBalanceRow({ cont: "704", contBase: "704", totalCred: 100 })];
    const section = computeIndustryKpis(thinRows, emptyCatalog, {
      industry: "general",
      industrySource: "default",
      caen: null,
      year: 2026,
      month: 6,
    });
    expect(section.industry).toBe("general");
    expect(section.industrySource).toBe("default");
    expect(section.journalHint).toBeNull();
  });

  it("hint messages contain no em dash", () => {
    const section = computeIndustryKpis(comertRows, emptyCatalog, {
      industry: "consultanta",
      industrySource: "manual",
      caen: null,
      year: 2026,
      month: 6,
    });
    expect(section.journalHint!.message.includes("—")).toBe(false);
  });
});

describe("new computable KPIs (roce, fcfAprox, ruleOf40)", () => {
  const rows = [
    makeBalanceRow({ cont: "704", contBase: "704", totalCred: 600000 }),
    makeBalanceRow({ cont: "641", contBase: "641", totalDeb: 200000 }),
    makeBalanceRow({ cont: "681", contBase: "681", totalDeb: 30000 }),
    makeBalanceRow({ cont: "1012", contBase: "1012", finC: 100000 }),
    makeBalanceRow({ cont: "1621", contBase: "1621", finC: 100000 }),
    makeBalanceRow({ cont: "213", contBase: "213", finD: 50000, totalDeb: 24000 }),
  ];
  const section = computeIndustryKpis(rows, emptyCatalog, {
    industry: "general",
    industrySource: "manual",
    caen: null,
    year: 2026,
    month: 6,
  });
  const byId = new Map(section.groups.flatMap((g) => g.kpis.map((k) => [k.id, k])));

  it("roce = EBIT anualizat / capital angajat", () => {
    const roce = byId.get("roce")!;
    // EBIT = 600000 - 230000 = 370000; anualizat 740000; CE = 200000
    expect(roce.value).toBeCloseTo(370, 0);
    expect(roce.calculation).toContain("capital angajat");
  });

  it("fcfAprox = EBITDA - impozit - capex", () => {
    const fcf = byId.get("fcfAprox")!;
    // EBITDA = 370000 + 30000 = 400000; impozit 0; capex 24000
    expect(fcf.value).toBe(376000);
    expect(fcf.state).toBe("good");
  });

  it("ruleOf40 unavailable without prior-year data", () => {
    const r40 = byId.get("ruleOf40")!;
    expect(r40.value).toBeNull();
  });

  it("ruleOf40 = growth + EBITDA margin with prior year", () => {
    const withPrev = computeIndustryKpis(rows, emptyCatalog, {
      industry: "general",
      industrySource: "manual",
      caen: null,
      year: 2026,
      month: 6,
      prevYearRows: [makeBalanceRow({ cont: "704", contBase: "704", totalCred: 500000 })],
    });
    const r40 = withPrev.groups.flatMap((g) => g.kpis).find((k) => k.id === "ruleOf40")!;
    // growth = 20%; marja EBITDA = 400000/600000 = 66.67% -> 86.67
    expect(r40.value).toBeCloseTo(86.67, 1);
    expect(r40.state).toBe("good");
  });
});
