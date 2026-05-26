/**
 * Validates detectTaxRegimeTimeline against all 14 real client journals.
 *
 * Each fixture has an expected timeline that matches what the accountant
 * actually does — proven by inspecting the originating tax accruals in the
 * journal. If the detector ever drifts from these expectations, this suite
 * tells us exactly which client broke.
 *
 * Each expectation also records WHY it is what it is (the dominant 69x
 * account in each year + the salary signal that splits 1% from 3%).
 */
import { describe, it, expect } from "vitest";
import {
  detectTaxRegimeTimeline,
  detectRegimeForPeriod,
} from "@/modules/clients/tax-regime-detector";
import { loadJournal } from "@tests/fixtures/reference/helpers";
import type { TaxRegime } from "@/modules/accounts";

interface ExpectedTransition {
  startDate: string;
  taxRegime: TaxRegime;
  warningContains?: string[];
}

interface ClientCase {
  fixture: string;
  label: string;
  expected: ExpectedTransition[];
}

const CASES: ClientCase[] = [
  {
    fixture: "qhm-registru-jurnal.xlsx",
    label: "QHM21 — micro→standard, oscillating 2025 (16% + 3%)",
    expected: [
      { startDate: "2013-01-01", taxRegime: "profit_micro_3" },
      { startDate: "2014-01-01", taxRegime: "profit_micro_1" },
      { startDate: "2016-01-01", taxRegime: "profit_micro_3" },
      {
        startDate: "2023-01-01",
        taxRegime: "profit_standard",
        warningContains: ["2025 are semnale multiple"],
      },
    ],
  },
  {
    fixture: "4walls-kronis-registru-jurnal.xlsx",
    label: "4walls Kronis — micro_3 → micro_1 → standard",
    expected: [
      { startDate: "2017-01-01", taxRegime: "profit_micro_3" },
      { startDate: "2022-01-01", taxRegime: "profit_micro_1" },
      {
        startDate: "2024-01-01",
        taxRegime: "profit_standard",
        warningContains: ["2024 are semnale multiple"],
      },
    ],
  },
  {
    fixture: "widder-registru-jurnal.xlsx",
    label: "Widder — micro_1 ↔ micro_3 → standard",
    expected: [
      { startDate: "2020-01-01", taxRegime: "profit_micro_1" },
      { startDate: "2021-01-01", taxRegime: "profit_micro_3" },
      { startDate: "2022-01-01", taxRegime: "profit_micro_1" },
      { startDate: "2023-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "enadri-registru-jurnal.xls",
    label: "Enadri — micro_3 → micro_1, never switched off micro",
    expected: [
      { startDate: "2018-01-01", taxRegime: "profit_micro_3" },
      { startDate: "2019-01-01", taxRegime: "profit_micro_1" },
    ],
  },
  {
    fixture: "citibox-registru-jurnal.xlsx",
    label: "Citibox — new firm, standard from day one",
    expected: [
      { startDate: "2025-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "titan-registru-jurnal.xlsx",
    label: "Titan — micro_1 (2025) → standard (2026)",
    expected: [
      { startDate: "2025-01-01", taxRegime: "profit_micro_1" },
      { startDate: "2026-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "medezen-registru-jurnal.xls",
    label: "Medezen — micro_3 → micro_1 → standard",
    expected: [
      { startDate: "2017-01-01", taxRegime: "profit_micro_3" },
      { startDate: "2022-01-01", taxRegime: "profit_micro_1" },
      { startDate: "2026-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "flavus-registru-jurnal.xlsx",
    label: "Flavus — standard from start",
    expected: [
      { startDate: "2025-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "upperhouse-registru-jurnal.xlsx",
    label: "Upperhouse — micro_1 → standard, 2024 over micro plafond",
    expected: [
      {
        startDate: "2015-01-01",
        taxRegime: "profit_micro_1",
        warningContains: ["2024 are semnale multiple", "depaseste plafonul micro"],
      },
      { startDate: "2025-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "hello-registru-jurnal.xlsx",
    label: "Hello Numbers — micro_1 → standard (rebooked 2024)",
    expected: [
      { startDate: "2019-01-01", taxRegime: "profit_micro_1" },
      {
        startDate: "2024-01-01",
        taxRegime: "profit_standard",
        warningContains: ["2024 are semnale multiple"],
      },
    ],
  },
  {
    fixture: "cs-analytiqs-registru-jurnal.xlsx",
    label: "CS Analytiqs — micro_3 → micro_1 → standard",
    expected: [
      { startDate: "2016-01-01", taxRegime: "profit_micro_3" },
      { startDate: "2017-01-01", taxRegime: "profit_micro_1" },
      {
        startDate: "2024-01-01",
        taxRegime: "profit_standard",
        warningContains: ["2024 are semnale multiple"],
      },
    ],
  },
  {
    fixture: "swat-registru-jurnal.xlsx",
    label: "SWAT — standard → micro_1 (rare reverse direction)",
    expected: [
      { startDate: "2023-01-01", taxRegime: "profit_standard" },
      { startDate: "2025-01-01", taxRegime: "profit_micro_1" },
    ],
  },
  {
    fixture: "kluthe-registru-jurnal.xls",
    label: "Kluthe — standard from start",
    expected: [
      { startDate: "2024-01-01", taxRegime: "profit_standard" },
    ],
  },
  {
    fixture: "korner-registru-jurnal.xlsx",
    label: "Korner — micro_1 only",
    expected: [
      { startDate: "2023-01-01", taxRegime: "profit_micro_1" },
    ],
  },
];

describe("detectTaxRegimeTimeline — against real client fixtures", () => {
  for (const c of CASES) {
    it(c.label, () => {
      const journal = loadJournal(c.fixture);
      const detected = detectTaxRegimeTimeline(journal.entries);

      expect(detected.length, `expected ${c.expected.length} transitions, got ${detected.length}`).toBe(c.expected.length);

      for (let i = 0; i < c.expected.length; i++) {
        const got = detected[i];
        const want = c.expected[i];
        const gotDate = got.startDate.toISOString().slice(0, 10);
        expect(gotDate, `transition #${i} startDate`).toBe(want.startDate);
        expect(got.taxRegime, `transition #${i} regime (got=${gotDate})`).toBe(want.taxRegime);
        if (want.warningContains) {
          for (const fragment of want.warningContains) {
            const joined = got.warnings.join(" | ");
            expect(joined, `transition #${i} should warn about "${fragment}"`).toContain(fragment);
          }
        }
      }
    });
  }
});

/**
 * The UI calls detectRegimeForPeriod every time the user selects a different
 * month in the CPP/Balanta tab. The badge in the page header reflects what
 * the journal says for THAT period — not the most recent regime.
 *
 * For each client we pick at least one month per detected transition and
 * assert the resolved regime matches.
 */
interface MonthCase {
  fixture: string;
  label: string;
  checks: Array<{
    year: number;
    month: number;
    expectedRegime: TaxRegime;
    isFallback?: boolean;
  }>;
}

const MONTH_CASES: MonthCase[] = [
  {
    fixture: "qhm-registru-jurnal.xlsx",
    label: "QHM21 — full timeline including pre-history fallback",
    checks: [
      // Pre-history before 2013: fallback applied (no transition yet)
      { year: 2012, month: 12, expectedRegime: "profit_standard", isFallback: true },
      // 2013 micro_3 era
      { year: 2013, month: 6, expectedRegime: "profit_micro_3" },
      { year: 2013, month: 12, expectedRegime: "profit_micro_3" },
      // 2014 picks up micro_1 (salary signal appeared)
      { year: 2014, month: 1, expectedRegime: "profit_micro_1" },
      { year: 2015, month: 12, expectedRegime: "profit_micro_1" },
      // 2016 reverts to micro_3 (salaries gone)
      { year: 2016, month: 1, expectedRegime: "profit_micro_3" },
      { year: 2022, month: 12, expectedRegime: "profit_micro_3" },
      // 2023 onwards: profit_standard
      { year: 2023, month: 1, expectedRegime: "profit_standard" },
      { year: 2024, month: 12, expectedRegime: "profit_standard" },
      { year: 2026, month: 3, expectedRegime: "profit_standard" },
    ],
  },
  {
    fixture: "widder-registru-jurnal.xlsx",
    label: "Widder — month resolution across all 4 transitions",
    checks: [
      { year: 2019, month: 12, expectedRegime: "profit_standard", isFallback: true },
      { year: 2020, month: 1, expectedRegime: "profit_micro_1" },
      { year: 2020, month: 12, expectedRegime: "profit_micro_1" },
      { year: 2021, month: 1, expectedRegime: "profit_micro_3" },
      { year: 2021, month: 12, expectedRegime: "profit_micro_3" },
      { year: 2022, month: 6, expectedRegime: "profit_micro_1" },
      { year: 2023, month: 1, expectedRegime: "profit_standard" },
      { year: 2025, month: 12, expectedRegime: "profit_standard" },
    ],
  },
  {
    fixture: "upperhouse-registru-jurnal.xlsx",
    label: "Upperhouse — micro_1 (2015–2024) then standard from 2025",
    checks: [
      { year: 2014, month: 12, expectedRegime: "profit_standard", isFallback: true },
      { year: 2015, month: 1, expectedRegime: "profit_micro_1" },
      { year: 2020, month: 6, expectedRegime: "profit_micro_1" },
      { year: 2024, month: 12, expectedRegime: "profit_micro_1" },
      { year: 2025, month: 1, expectedRegime: "profit_standard" },
      { year: 2026, month: 2, expectedRegime: "profit_standard" },
    ],
  },
  {
    fixture: "titan-registru-jurnal.xlsx",
    label: "Titan — micro_1 in 2025, standard in 2026",
    checks: [
      { year: 2024, month: 12, expectedRegime: "profit_standard", isFallback: true },
      { year: 2025, month: 1, expectedRegime: "profit_micro_1" },
      { year: 2025, month: 12, expectedRegime: "profit_micro_1" },
      { year: 2026, month: 1, expectedRegime: "profit_standard" },
    ],
  },
  {
    fixture: "swat-registru-jurnal.xlsx",
    label: "SWAT — reverse direction (standard → micro_1)",
    checks: [
      { year: 2023, month: 1, expectedRegime: "profit_standard" },
      { year: 2024, month: 12, expectedRegime: "profit_standard" },
      { year: 2025, month: 1, expectedRegime: "profit_micro_1" },
      { year: 2025, month: 12, expectedRegime: "profit_micro_1" },
    ],
  },
  {
    fixture: "citibox-registru-jurnal.xlsx",
    label: "Citibox — single regime, single year",
    checks: [
      { year: 2024, month: 12, expectedRegime: "profit_standard", isFallback: true },
      { year: 2025, month: 1, expectedRegime: "profit_standard" },
      { year: 2025, month: 12, expectedRegime: "profit_standard" },
    ],
  },
  {
    fixture: "kluthe-registru-jurnal.xls",
    label: "Kluthe — single transition",
    checks: [
      { year: 2023, month: 12, expectedRegime: "profit_standard", isFallback: true },
      { year: 2024, month: 1, expectedRegime: "profit_standard" },
      { year: 2024, month: 12, expectedRegime: "profit_standard" },
    ],
  },
  {
    fixture: "korner-registru-jurnal.xlsx",
    label: "Korner — single micro transition, every month resolves to it",
    checks: [
      { year: 2022, month: 12, expectedRegime: "profit_standard", isFallback: true },
      { year: 2023, month: 1, expectedRegime: "profit_micro_1" },
      { year: 2023, month: 6, expectedRegime: "profit_micro_1" },
      { year: 2024, month: 12, expectedRegime: "profit_micro_1" },
    ],
  },
];

describe("detectRegimeForPeriod — what the UI shows when a month is selected", () => {
  for (const c of MONTH_CASES) {
    describe(c.label, () => {
      const journal = loadJournal(c.fixture);
      for (const check of c.checks) {
        const period = `${check.year}-${String(check.month).padStart(2, "0")}`;
        it(`${period} -> ${check.expectedRegime}${check.isFallback ? " (fallback)" : ""}`, () => {
          const got = detectRegimeForPeriod(journal.entries, check.year, check.month);
          expect(got.taxRegime).toBe(check.expectedRegime);
          if (check.isFallback) {
            expect(got.isFallback).toBe(true);
            expect(got.source).toBeNull();
          } else {
            expect(got.isFallback).toBe(false);
            expect(got.source).not.toBeNull();
            expect(got.source!.taxRegime).toBe(check.expectedRegime);
          }
        });
      }
    });
  }
});

describe("detectRegimeForPeriod — pure-function edge cases", () => {
  it("returns fallback with isFallback=true on empty journal", () => {
    const got = detectRegimeForPeriod([], 2025, 6);
    expect(got.taxRegime).toBe("profit_standard");
    expect(got.isFallback).toBe(true);
    expect(got.source).toBeNull();
  });

  it("respects custom fallback for empty journal", () => {
    const got = detectRegimeForPeriod([], 2025, 6, { fallback: "profit_micro_1" });
    expect(got.taxRegime).toBe("profit_micro_1");
    expect(got.isFallback).toBe(true);
  });

  it("source.warnings is surfaced so UI can show 'verifica regimul' badge", () => {
    const journal = loadJournal("upperhouse-registru-jurnal.xlsx");
    // Upperhouse 2024 has both mixed-signal and plafond-exceeded warnings.
    const got = detectRegimeForPeriod(journal.entries, 2024, 6);
    expect(got.source).not.toBeNull();
    expect(got.source!.warnings.length).toBeGreaterThan(0);
    const joined = got.source!.warnings.join(" | ");
    expect(joined).toContain("depaseste plafonul micro");
  });
});

describe("detectTaxRegimeTimeline — pure-function edge cases", () => {
  it("returns empty timeline for empty journal", () => {
    expect(detectTaxRegimeTimeline([])).toEqual([]);
  });

  it("emits fallback regime when journal has no tax accruals", () => {
    const journal = loadJournal("korner-registru-jurnal.xlsx");
    const noTaxEntries = journal.entries.filter(
      (e) => !["691", "698", "697", "695"].includes(e.contDBase)
    );
    const detected = detectTaxRegimeTimeline(noTaxEntries);
    expect(detected.length).toBe(1);
    expect(detected[0].taxRegime).toBe("profit_standard");
    expect(detected[0].confidence).toBe("low");
  });

  it("respects custom fallback", () => {
    const journal = loadJournal("korner-registru-jurnal.xlsx");
    const noTaxEntries = journal.entries.filter(
      (e) => !["691", "698", "697", "695"].includes(e.contDBase)
    );
    const detected = detectTaxRegimeTimeline(noTaxEntries, { fallback: "profit_micro_1" });
    expect(detected[0].taxRegime).toBe("profit_micro_1");
  });

  it("ignores year-end closing entries (121 = 69x) — they would otherwise double-count", () => {
    const journal = loadJournal("qhm-registru-jurnal.xlsx");
    const detected = detectTaxRegimeTimeline(journal.entries);
    // QHM21 2023 has both 691/4411 = 7073 (originating) and 121/691 = 7073 (closing).
    // The detector must only count the originating one. We verify by inspecting
    // the reason string for 2023.
    const qStandard = detected.find((d) => d.startDate.toISOString().slice(0, 10) === "2023-01-01");
    expect(qStandard).toBeDefined();
    expect(qStandard!.taxRegime).toBe("profit_standard");
    // Sum of 691/4411 accruals in 2023 for QHM = 1707 + 752 + 4614 = 7073
    expect(qStandard!.reason).toContain("7073");
  });
});
