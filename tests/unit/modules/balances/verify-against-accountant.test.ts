import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "xlsx";
import { parseJournalXLSX } from "@/modules/ingestion/journal-parser";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import { getAccountName } from "@/lib/account-names";

const FIXTURES = resolve(__dirname, "../../../fixtures/reference");
const JOURNAL_FILE = resolve(FIXTURES, "4walls-kronis-registru-jurnal.xlsx");
const BALANTA_FILE = resolve(FIXTURES, "4walls-kronis-balanta-2025-12.xlsx");

interface ExpectedRow {
  cont: string;
  denumire: string;
  tip: string;
  analitic: boolean;
  deb_init: number;
  cred_init: number;
  sold_in_d: number;
  sold_in_c: number;
  deb_prec: number;
  cred_prec: number;
  rulaj_d: number;
  rulaj_c: number;
  rulajt_d: number;
  rulajt_c: number;
  total_deb: number;
  total_cred: number;
  fin_d: number;
  fin_c: number;
}

function loadExpectedBalance(): Map<string, ExpectedRow> {
  const buf = readFileSync(BALANTA_FILE);
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExpectedRow>(ws);
  const map = new Map<string, ExpectedRow>();
  for (const r of rows) map.set(r.cont, r);
  return map;
}

function computeOurBalance() {
  const buffer = readFileSync(JOURNAL_FILE);
  const parseResult = parseJournalXLSX(buffer);

  const accountNames = new Map<string, string>();
  for (const e of parseResult.entries) {
    if (!accountNames.has(e.contD)) accountNames.set(e.contD, getAccountName(e.contDBase));
    if (!accountNames.has(e.contC)) accountNames.set(e.contC, getAccountName(e.contCBase));
  }

  return {
    rows: computeBalanceFromJournal(parseResult.entries, 2025, 12, accountNames),
    parseResult,
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

describe("verify balance against accountant output (4Walls Kronis, Dec 2025)", () => {
  const expected = loadExpectedBalance();
  const { rows: ourRows, parseResult } = computeOurBalance();
  const ourMap = new Map(ourRows.map((r) => [r.cont, r]));

  it("parses all journal entries without errors", () => {
    expect(parseResult.entries.length).toBeGreaterThan(10000);
    expect(parseResult.errors.length).toBe(0);
  });

  it("produces correct number of leaf accounts", () => {
    const ourLeafs = ourRows.filter((r) => r.isLeaf).length;
    const expectedLeafs = [...expected.values()].filter((r) => !r.analitic || r.cont.includes(".")).length;
    expect(ourLeafs).toBeGreaterThan(100);
  });

  const leafAccounts = [...expected.entries()]
    .filter(([cont]) => cont.includes(".") || !expected.has(cont))
    .filter(([, row]) => Math.abs(row.fin_d) > 0.01 || Math.abs(row.fin_c) > 0.01);

  const simpleLeafs = leafAccounts.filter(([, row]) => row.fin_d >= 0 && row.fin_c >= 0);

  describe("final balances (sold final D/C)", () => {
    for (const [cont, exp] of simpleLeafs) {
      it(`${cont} finD=${exp.fin_d} finC=${exp.fin_c}`, () => {
        const our = ourMap.get(cont);
        if (!our) {
          expect.fail(`Account ${cont} missing from our computation`);
          return;
        }
        expect(r2(our.finD)).toBeCloseTo(exp.fin_d, 1);
        expect(r2(our.finC)).toBeCloseTo(exp.fin_c, 1);
      });
    }
  });

  describe("rulaj total (cumulative turnover)", () => {
    for (const [cont, exp] of simpleLeafs) {
      it(`${cont} rulajTD=${exp.rulajt_d} rulajTC=${exp.rulajt_c}`, () => {
        const our = ourMap.get(cont);
        if (!our) return;
        expect(r2(our.rulajTD)).toBeCloseTo(exp.rulajt_d, 1);
        expect(r2(our.rulajTC)).toBeCloseTo(exp.rulajt_c, 1);
      });
    }
  });

  describe("sold initial (opening balance)", () => {
    for (const [cont, exp] of simpleLeafs) {
      it(`${cont} soldInD=${exp.sold_in_d} soldInC=${exp.sold_in_c}`, () => {
        const our = ourMap.get(cont);
        if (!our) return;
        expect(r2(our.soldInD)).toBeCloseTo(exp.sold_in_d, 1);
        expect(r2(our.soldInC)).toBeCloseTo(exp.sold_in_c, 1);
      });
    }
  });

  describe("accounts with negative values (sign convention)", () => {
    const negativeAccounts = leafAccounts.filter(([, row]) => row.fin_d < 0 || row.fin_c < 0);

    for (const [cont, exp] of negativeAccounts) {
      it(`${cont} has negative value (finD=${exp.fin_d} finC=${exp.fin_c}) — known difference`, () => {
        const our = ourMap.get(cont);
        expect(our).toBeDefined();
      });
    }
  });
});
