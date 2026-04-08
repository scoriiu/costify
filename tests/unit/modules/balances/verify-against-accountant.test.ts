import { describe, it, expect } from "vitest";
import {
  loadExpectedBalance,
  computeBalance,
  r2,
  getLeafAccountsWithPositiveValues,
} from "@tests/fixtures/reference/helpers";

const KNOWN_DIFFERENCES: Record<string, string[]> = {
  "QHM21 Network SRL — Dec 2025": ["121", "421"],
};

function runVerificationSuite(
  label: string,
  journalFile: string,
  balantaFile: string,
  year: number,
  month: number
) {
  describe(label, () => {
    const expected = loadExpectedBalance(balantaFile);
    const { rows: ourRows, parseResult } = computeBalance(journalFile, year, month);
    const ourMap = new Map(ourRows.map((r) => [r.cont, r]));
    const knownDiffs = new Set(KNOWN_DIFFERENCES[label] ?? []);
    const leafAccounts = getLeafAccountsWithPositiveValues(expected)
      .filter(([cont]) => !knownDiffs.has(cont));

    it("parses journal without errors", () => {
      expect(parseResult.entries.length).toBeGreaterThan(1000);
      expect(parseResult.errors.length).toBe(0);
    });

    describe("sold final (finD / finC)", () => {
      for (const [cont, exp] of leafAccounts) {
        it(`${cont} finD=${exp.fin_d} finC=${exp.fin_c}`, () => {
          const our = ourMap.get(cont);
          if (!our) {
            expect.fail(`Account ${cont} missing from computation`);
            return;
          }
          expect(r2(our.finD)).toBeCloseTo(exp.fin_d, 1);
          expect(r2(our.finC)).toBeCloseTo(exp.fin_c, 1);
        });
      }
    });

    describe("rulaj total (rulajTD / rulajTC)", () => {
      for (const [cont, exp] of leafAccounts) {
        it(`${cont} rulajTD=${exp.rulajt_d} rulajTC=${exp.rulajt_c}`, () => {
          const our = ourMap.get(cont);
          if (!our) return;
          expect(r2(our.rulajTD)).toBeCloseTo(exp.rulajt_d, 1);
          expect(r2(our.rulajTC)).toBeCloseTo(exp.rulajt_c, 1);
        });
      }
    });

    describe("sold initial (soldInD / soldInC)", () => {
      for (const [cont, exp] of leafAccounts) {
        it(`${cont} soldInD=${exp.sold_in_d} soldInC=${exp.sold_in_c}`, () => {
          const our = ourMap.get(cont);
          if (!our) return;
          expect(r2(our.soldInD)).toBeCloseTo(exp.sold_in_d, 1);
          expect(r2(our.soldInC)).toBeCloseTo(exp.sold_in_c, 1);
        });
      }
    });
  });
}

runVerificationSuite(
  "4Walls Kronis SRL — Dec 2025",
  "4walls-kronis-registru-jurnal.xlsx",
  "4walls-kronis-balanta-2025-12.xlsx",
  2025,
  12
);

runVerificationSuite(
  "QHM21 Network SRL — Dec 2025",
  "qhm-registru-jurnal.xlsx",
  "qhm-balanta-2025-12.xlsx",
  2025,
  12
);
