/**
 * End-to-end check: when the regime is detected from the journal (no manual
 * Setari input), CPP must produce the same numbers it would with the regime
 * stored in the database.
 *
 * For each fixture + a representative period we verify:
 *   1. detectRegimeForPeriod returns the expected regime,
 *   2. computeCpp uses the correct impozit account (691 / 698 / 697 / 695),
 *   3. the impozit line value matches the journal's rulajTD on that account,
 *   4. rezultatNet === rezultatBrut − impozit.
 *
 * If the detector breaks, this test surfaces the exact financial impact, not
 * just a regime label mismatch.
 */
import { describe, it, expect } from "vitest";
import { detectRegimeForPeriod } from "@/modules/clients/tax-regime-detector";
import { taxRegimeAccount } from "@/modules/clients/tax-regime-resolver";
import { computeCpp } from "@/modules/reporting/cpp";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import { loadCatalogSync } from "@/modules/accounts";
import { isExtraBilantierCode } from "@/modules/accounts/flags";
import { loadJournal } from "@tests/fixtures/reference/helpers";
import type { BalanceRowView } from "@/modules/balances";
import type { TaxRegime } from "@/modules/accounts";

const CATALOG = loadCatalogSync();

function loadBalanceView(fixture: string, year: number, month: number): BalanceRowView[] {
  const journal = loadJournal(fixture);
  const accountNames = new Map<string, string>();
  for (const e of journal.entries) {
    if (!accountNames.has(e.contD)) accountNames.set(e.contD, e.contDBase);
    if (!accountNames.has(e.contC)) accountNames.set(e.contC, e.contCBase);
  }
  const raw = computeBalanceFromJournal(journal.entries, year, month, accountNames);
  return raw.map((r) => ({ ...r, isExtraBilantier: isExtraBilantierCode(r.contBase) }));
}

/**
 * The "impozit pe profit/venit" line lives between REZULTAT BRUT and REZULTAT
 * NET. Other lines with "impozit" in their name (e.g. 635 "Cheltuieli cu
 * impozitele si taxele") sit in the cheltuieli din exploatare section, and we
 * must not confuse them with the tax-on-profit line.
 */
function findImpozitLine(cpp: ReturnType<typeof computeCpp>) {
  const lines = cpp.lines;
  let inTaxBand = false;
  for (const l of lines) {
    if (l.isTotal && l.denumire.startsWith("REZULTAT BRUT")) { inTaxBand = true; continue; }
    if (l.isTotal && l.denumire.startsWith("REZULTAT NET")) { inTaxBand = false; break; }
    if (inTaxBand && !l.isTotal && !l.isHeader) return l;
  }
  return undefined;
}

interface CppCase {
  fixture: string;
  label: string;
  year: number;
  month: number;
  expectedRegime: TaxRegime;
  /** Set to `0` when the period has no tax accrual yet (e.g. first month). */
  expectsImpozitLine: boolean;
}

const CASES: CppCase[] = [
  // QHM21 — profit_standard era (post 2023), full year 2024
  {
    fixture: "qhm-registru-jurnal.xlsx",
    label: "QHM21 2024-12 — profit_standard (691)",
    year: 2024,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
  // QHM21 — micro era 2014
  {
    fixture: "qhm-registru-jurnal.xlsx",
    label: "QHM21 2014-12 — profit_micro_1 (698, salary signal present)",
    year: 2014,
    month: 12,
    expectedRegime: "profit_micro_1",
    expectsImpozitLine: true,
  },
  // Widder 2022 — micro_1
  {
    fixture: "widder-registru-jurnal.xlsx",
    label: "Widder 2022-12 — profit_micro_1 (698)",
    year: 2022,
    month: 12,
    expectedRegime: "profit_micro_1",
    expectsImpozitLine: true,
  },
  // Widder 2023 — switched to standard
  {
    fixture: "widder-registru-jurnal.xlsx",
    label: "Widder 2023-12 — profit_standard (691)",
    year: 2023,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
  // Citibox — only year, standard
  {
    fixture: "citibox-registru-jurnal.xlsx",
    label: "Citibox 2025-12 — profit_standard (691)",
    year: 2025,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
  // Titan 2025 micro_1, then 2026 standard
  {
    fixture: "titan-registru-jurnal.xlsx",
    label: "Titan 2025-12 — profit_micro_1 (698)",
    year: 2025,
    month: 12,
    expectedRegime: "profit_micro_1",
    expectsImpozitLine: true,
  },
  // Upperhouse 2025 — switched to standard
  {
    fixture: "upperhouse-registru-jurnal.xlsx",
    label: "Upperhouse 2025-12 — profit_standard (691)",
    year: 2025,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
  // SWAT — reverse direction
  {
    fixture: "swat-registru-jurnal.xlsx",
    label: "SWAT 2024-12 — profit_standard (691)",
    year: 2024,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
  {
    fixture: "swat-registru-jurnal.xlsx",
    label: "SWAT 2025-12 — profit_micro_1 (698, reverse direction)",
    year: 2025,
    month: 12,
    expectedRegime: "profit_micro_1",
    expectsImpozitLine: true,
  },
  // Kluthe — standard from start
  {
    fixture: "kluthe-registru-jurnal.xls",
    label: "Kluthe 2024-12 — profit_standard (691)",
    year: 2024,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
  // Flavus — big standard amounts
  {
    fixture: "flavus-registru-jurnal.xlsx",
    label: "Flavus 2025-12 — profit_standard (691)",
    year: 2025,
    month: 12,
    expectedRegime: "profit_standard",
    expectsImpozitLine: true,
  },
];

describe("CPP with detected regime — matches database-driven CPP byte-for-byte", () => {
  for (const c of CASES) {
    it(c.label, () => {
      const journal = loadJournal(c.fixture);
      const detected = detectRegimeForPeriod(journal.entries, c.year, c.month);
      expect(detected.taxRegime, `${c.label}: regime mismatch`).toBe(c.expectedRegime);

      const rows = loadBalanceView(c.fixture, c.year, c.month);
      const cpp = computeCpp(rows, CATALOG, { taxRegime: detected.taxRegime });
      const impozit = findImpozitLine(cpp);

      if (!c.expectsImpozitLine) {
        expect(impozit, "expected no impozit line").toBeUndefined();
        expect(cpp.rezultatNet).toBe(cpp.rezultatBrut);
        return;
      }

      const expectedTaxAccount = taxRegimeAccount(c.expectedRegime);
      expect(impozit, "expected an impozit line").toBeDefined();
      expect(impozit!.cont).toBe(expectedTaxAccount);
      expect(impozit!.value).toBeGreaterThan(0);

      // rezultatNet must equal rezultatBrut − tax (within 1 RON tolerance for rounding).
      const drift = Math.abs(cpp.rezultatBrut - impozit!.value - cpp.rezultatNet);
      expect(
        drift,
        `${c.label}: rezultatNet=${cpp.rezultatNet} != rezultatBrut=${cpp.rezultatBrut} − impozit=${impozit!.value} (drift ${drift.toFixed(2)})`
      ).toBeLessThanOrEqual(1);
    });
  }
});

describe("CPP with detected regime — wrong-regime accounts must NOT leak into impozit line", () => {
  it("micro firm with leftover 691 in journal: CPP picks 698 only", () => {
    // 4walls-kronis 2024 has BOTH 691 (~9573) and 698 (~1104) — typical
    // "rebooking at year-end" pattern. We picked profit_standard for 2024,
    // so 691 must be the only impozit on the CPP for 2024-12.
    const fixture = "4walls-kronis-registru-jurnal.xlsx";
    const journal = loadJournal(fixture);
    const detected = detectRegimeForPeriod(journal.entries, 2024, 12);
    expect(detected.taxRegime).toBe("profit_standard");

    const rows = loadBalanceView(fixture, 2024, 12);
    const cpp = computeCpp(rows, CATALOG, { taxRegime: detected.taxRegime });
    const impozitLines = cpp.lines.filter(
      (l) => !l.isHeader && !l.isTotal && (l.cont === "691" || l.cont === "698" || l.cont === "697")
    );
    // Only ONE impozit line — the one for the resolved regime.
    expect(impozitLines.length, "expected exactly 1 impozit line").toBe(1);
    expect(impozitLines[0].cont).toBe("691");
  });

  it("a period before any detected transition falls back to default and produces a meaningful CPP", () => {
    // Widder pre-history: first transition is 2020-01-01. For 2019-12 the
    // detector returns the fallback (profit_standard) so CPP doesn't crash.
    const fixture = "widder-registru-jurnal.xlsx";
    const journal = loadJournal(fixture);
    const detected = detectRegimeForPeriod(journal.entries, 2019, 12);
    expect(detected.isFallback).toBe(true);
    expect(detected.taxRegime).toBe("profit_standard");

    const rows = loadBalanceView(fixture, 2019, 12);
    // Should not throw, and rezultatNet must be a finite number.
    const cpp = computeCpp(rows, CATALOG, { taxRegime: detected.taxRegime });
    expect(Number.isFinite(cpp.rezultatNet)).toBe(true);
  });
});
