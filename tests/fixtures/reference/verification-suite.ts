/**
 * Shared helper for client-by-client balance verification suites.
 *
 * Each client has its own test file (e.g. `qhm21.test.ts`, `widder.test.ts`)
 * that calls `runVerificationSuite(...)` once per period. This way a failure
 * on one client doesn't drown in the output of the others, and a developer
 * can run a single client with:
 *
 *     pnpm test:unit tests/unit/modules/balances/widder.test.ts
 *
 * Per-client quirks (Saga negative-side anomalies, etc.) belong in the
 * client's own test file via the `knownDifferences` option, not in a global
 * dictionary here.
 */
import { describe, it, expect } from "vitest";
import {
  loadExpectedBalance,
  computeBalance,
  r2,
  getLeafAccountsWithPositiveValues,
} from "./helpers";

export interface VerificationOptions {
  /**
   * Accounts whose Saga export carries a known anomaly we accept as a
   * documented difference (e.g. negative sold creditor = positive sold
   * debitor, presented differently by Saga vs Costify).
   */
  knownDifferences?: string[];
  /**
   * If set, the suite is registered with `.skip` and the reason is appended
   * to the suite label. Use when the fixture has known issues that need
   * accountant review before they can be treated as bugs.
   */
  skip?: string;
}

export function runVerificationSuite(
  label: string,
  journalFile: string,
  balantaFile: string,
  year: number,
  month: number,
  options: VerificationOptions = {}
): void {
  const describeFn = options.skip ? describe.skip : describe;
  const fullLabel = options.skip ? `${label} [SKIPPED: ${options.skip}]` : label;
  describeFn(fullLabel, () => {
    const expected = loadExpectedBalance(balantaFile);
    const { rows: ourRows, parseResult } = computeBalance(journalFile, year, month);
    const ourMap = new Map(ourRows.map((r) => [r.cont, r]));
    const knownDiffs = new Set(options.knownDifferences ?? []);
    const leafAccounts = getLeafAccountsWithPositiveValues(expected)
      .filter(([cont]) => !knownDiffs.has(cont));

    it("parses journal without errors", () => {
      expect(parseResult.entries.length).toBeGreaterThan(1000);
      expect(parseResult.errors.length).toBe(0);
    });

    // 1 RON tolerance — Saga and Costify can drift slightly on rounding of
    // analytic accounts (especially VAT prorata and salary calculations).
    // We don't care about sub-RON noise; we care about real discrepancies.
    const TOLERANCE = 1;
    const expectWithin = (actual: number, expected: number, label: string) => {
      const diff = Math.abs(actual - expected);
      expect(diff, `${label}: expected ${expected}, got ${actual}, diff ${diff.toFixed(2)} > ${TOLERANCE}`).toBeLessThanOrEqual(TOLERANCE);
    };

    describe("sold final (finD / finC)", () => {
      for (const [cont, exp] of leafAccounts) {
        it(`${cont} finD=${exp.fin_d} finC=${exp.fin_c}`, () => {
          const our = ourMap.get(cont);
          expect(our, `Account ${cont} missing from computation`).toBeDefined();
          expectWithin(r2(our!.finD), exp.fin_d, `${cont} finD`);
          expectWithin(r2(our!.finC), exp.fin_c, `${cont} finC`);
        });
      }
    });

    describe("rulaj total (rulajTD / rulajTC)", () => {
      for (const [cont, exp] of leafAccounts) {
        it(`${cont} rulajTD=${exp.rulajt_d} rulajTC=${exp.rulajt_c}`, () => {
          const our = ourMap.get(cont);
          expect(our, `Account ${cont} missing from computation`).toBeDefined();
          expectWithin(r2(our!.rulajTD), exp.rulajt_d, `${cont} rulajTD`);
          expectWithin(r2(our!.rulajTC), exp.rulajt_c, `${cont} rulajTC`);
        });
      }
    });

    describe("sold initial (soldInD / soldInC)", () => {
      for (const [cont, exp] of leafAccounts) {
        it(`${cont} soldInD=${exp.sold_in_d} soldInC=${exp.sold_in_c}`, () => {
          const our = ourMap.get(cont);
          expect(our, `Account ${cont} missing from computation`).toBeDefined();
          expectWithin(r2(our!.soldInD), exp.sold_in_d, `${cont} soldInD`);
          expectWithin(r2(our!.soldInC), exp.sold_in_c, `${cont} soldInC`);
        });
      }
    });
  });
}
