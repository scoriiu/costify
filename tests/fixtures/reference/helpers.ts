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

/**
 * Saga exports the balance with either UPPERCASE (CONT, DEB_INIT, ...) or
 * lowercase (cont, deb_init, ...) column headers depending on the version.
 * We normalize both to the lowercase shape the tests expect.
 */
function normalizeRow(raw: Record<string, unknown>): ExpectedRow {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase()] = v;
  return {
    cont: String(lower.cont ?? ""),
    denumire: String(lower.denumire ?? ""),
    tip: String(lower.tip ?? ""),
    analitic: Boolean(lower.analitic),
    deb_init: Number(lower.deb_init ?? 0),
    cred_init: Number(lower.cred_init ?? 0),
    sold_in_d: Number(lower.sold_in_d ?? 0),
    sold_in_c: Number(lower.sold_in_c ?? 0),
    deb_prec: Number(lower.deb_prec ?? 0),
    cred_prec: Number(lower.cred_prec ?? 0),
    rulaj_d: Number(lower.rulaj_d ?? 0),
    rulaj_c: Number(lower.rulaj_c ?? 0),
    rulajt_d: Number(lower.rulajt_d ?? 0),
    rulajt_c: Number(lower.rulajt_c ?? 0),
    total_deb: Number(lower.total_deb ?? 0),
    total_cred: Number(lower.total_cred ?? 0),
    fin_d: Number(lower.fin_d ?? 0),
    fin_c: Number(lower.fin_c ?? 0),
  };
}

/**
 * Saga's "raport tipărit" balance format — a print-ready report with company
 * header, section subtotals ("Total sume clasa N"), blank rows, and unnamed
 * positional columns. Column indices are fixed and inferred from a sample:
 *   0 cont · 3 denumire · 8 sold_in_d · 9 sold_in_c
 *   12 rulaj_d · 14 rulaj_c · 16 rulajt_d · 17 rulajt_c · 18 fin_d · 19 fin_c
 * Only rows whose cell[0] looks like a valid account number are kept.
 */
function parseReportFormat(ws: XLSX.WorkSheet): Map<string, ExpectedRow> {
  const arr = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const map = new Map<string, ExpectedRow>();
  const ACCT_RE = /^[0-9]{3,4}(\.[A-Z0-9]+)?$/i;
  for (const row of arr) {
    const cont = String(row[0] ?? "").trim();
    if (!ACCT_RE.test(cont)) continue;
    map.set(cont, {
      cont,
      denumire: String(row[3] ?? ""),
      tip: "",
      analitic: false,
      deb_init: 0,
      cred_init: 0,
      sold_in_d: Number(row[8] ?? 0),
      sold_in_c: Number(row[9] ?? 0),
      deb_prec: 0,
      cred_prec: 0,
      rulaj_d: Number(row[12] ?? 0),
      rulaj_c: Number(row[14] ?? 0),
      rulajt_d: Number(row[16] ?? 0),
      rulajt_c: Number(row[17] ?? 0),
      total_deb: 0,
      total_cred: 0,
      fin_d: Number(row[18] ?? 0),
      fin_c: Number(row[19] ?? 0),
    });
  }
  return map;
}

export function loadExpectedBalance(fileName: string): Map<string, ExpectedRow> {
  const buf = readFileSync(resolve(FIXTURES, fileName));
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  // Detect the report format: first row has a single huge string (company
  // header) and no recognizable column keys like "cont"/"CONT".
  const hasContColumn = rawRows.length > 0 && Object.keys(rawRows[0]).some(
    (k) => k.toLowerCase() === "cont"
  );
  if (!hasContColumn) {
    return parseReportFormat(ws);
  }

  const map = new Map<string, ExpectedRow>();
  for (const raw of rawRows) {
    const row = normalizeRow(raw);
    if (row.cont) map.set(row.cont, row);
  }
  return map;
}

/**
 * Load a parsed journal — preferring the pre-baked snapshot when it exists
 * (snapshots are gzipped JSON, ~15x faster than re-parsing the XLSX). The
 * snapshot lives next to the XLSX with the same stem and `.snapshot.json.gz`
 * extension. Regenerate via `pnpm tsx scripts/build-fixture-snapshot.ts`.
 */
export function loadJournal(journalFile: string): JournalParseResult {
  // Strip any spreadsheet extension (.xlsx, .xls, .ods) — Saga exports both
  // legacy .xls and modern .xlsx, and the snapshot lives next to either.
  const snapshotPath = resolve(
    FIXTURES,
    journalFile.replace(/\.(xlsx|xls|ods)$/i, ".snapshot.json.gz")
  );
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
