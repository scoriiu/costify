import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import * as XLSX from "xlsx";
import { parseJournalXLSX } from "@/modules/ingestion/journal-parser";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import { getAccountName } from "@/lib/account-names";
import type { JournalEntry, JournalParseResult } from "@/modules/ingestion/types";

const FIXTURES = resolve(__dirname);

interface SerializableEntry {
  data: string;
  year: number;
  month: number;
  ndp: string;
  contD: string;
  contDBase: string;
  contC: string;
  contCBase: string;
  suma: number;
  explicatie: string;
  felD: string;
  categorie: string | null;
  cod: string | null;
  validat: string | null;
  tva: number | null;
}

interface JournalSnapshot {
  source: string;
  generatedAt: string;
  totalRaw: number;
  years: number[];
  accountNames: [string, string][];
  entries: SerializableEntry[];
}

export interface ExpectedRow {
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

export function loadExpectedBalance(fileName: string): Map<string, ExpectedRow> {
  const buf = readFileSync(resolve(FIXTURES, fileName));
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExpectedRow>(ws);
  const map = new Map<string, ExpectedRow>();
  for (const r of rows) map.set(r.cont, r);
  return map;
}

/**
 * Load a parsed journal — preferring the pre-baked snapshot when it exists
 * (snapshots are gzipped JSON, ~15x faster than re-parsing the XLSX). The
 * snapshot lives next to the XLSX with the same stem and `.snapshot.json.gz`
 * extension. Regenerate via `pnpm tsx scripts/build-fixture-snapshot.ts`.
 */
export function loadJournal(journalFile: string): JournalParseResult {
  const snapshotPath = resolve(FIXTURES, journalFile.replace(/\.xlsx$/, ".snapshot.json.gz"));
  if (existsSync(snapshotPath)) {
    const compressed = readFileSync(snapshotPath);
    const json = gunzipSync(compressed).toString("utf8");
    const snap = JSON.parse(json) as JournalSnapshot;
    const entries: JournalEntry[] = snap.entries.map((e) => ({
      ...e,
      data: new Date(e.data),
    }));
    return {
      entries,
      years: snap.years,
      errors: [],
      totalRaw: snap.totalRaw,
      accountNames: new Map(snap.accountNames),
    };
  }
  const buffer = readFileSync(resolve(FIXTURES, journalFile));
  return parseJournalXLSX(buffer);
}

export function computeBalance(journalFile: string, year: number, month: number) {
  const parseResult = loadJournal(journalFile);

  const accountNames = new Map<string, string>();
  for (const e of parseResult.entries) {
    if (!accountNames.has(e.contD)) accountNames.set(e.contD, getAccountName(e.contDBase));
    if (!accountNames.has(e.contC)) accountNames.set(e.contC, getAccountName(e.contCBase));
  }

  return {
    rows: computeBalanceFromJournal(parseResult.entries, year, month, accountNames),
    parseResult,
  };
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getLeafAccountsWithPositiveValues(expected: Map<string, ExpectedRow>) {
  return [...expected.entries()]
    .filter(([cont]) => cont.includes(".") || !([...expected.keys()].some(k => k !== cont && k.startsWith(cont))))
    .filter(([, row]) => (Math.abs(row.fin_d) > 0.01 || Math.abs(row.fin_c) > 0.01))
    .filter(([, row]) => row.fin_d >= 0 && row.fin_c >= 0);
}
