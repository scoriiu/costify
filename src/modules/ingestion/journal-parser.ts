import * as XLSX from "xlsx";
import { normalizeMoney } from "@/lib/money";
import { getContBase } from "@/lib/accounts";
import { resolveHeaders } from "./header-resolver";
import { streamSagaSheet, type SagaRow } from "./saga-stream";
import type { JournalEntry, JournalParseResult, ParseError } from "./types";

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return date ? new Date(date.y, date.m - 1, date.d) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Romanian/European format: DD.MM.YYYY or DD/MM/YYYY (optionally with time).
    // Saga exports dates in this format as text in some templates.
    const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Saga sometimes stores dates as Excel serial numbers (cell type omitted or
 * numeric) and sometimes as plain strings. When parsing the streaming SAX
 * output we lose the typed Date conversion that the legacy `xlsx` library
 * did automatically, so we re-interpret a small numeric string in the date
 * column as a serial. ~25569 = 1970-01-01, ~46000 = 2025-ish — anything
 * outside that range is either a real string-formatted date or garbage.
 */
function maybeSerialDate(raw: string): unknown {
  if (raw === "") return "";
  const n = Number(raw);
  if (Number.isFinite(n) && n > 20000 && n < 60000 && !raw.includes("/") && !raw.includes(".") && !raw.includes("-")) {
    return n;
  }
  return raw;
}

function makeEntry(
  date: Date, ndp: string, contD: string, contC: string, suma: number,
  explicatie: string, felD: string, categorie: string | null,
  cod: string | null, validat: string | null, tva: number | null
): JournalEntry {
  return {
    data: date, year: date.getFullYear(), month: date.getMonth() + 1,
    ndp, contD, contDBase: getContBase(contD), contC, contCBase: getContBase(contC),
    suma, explicatie, felD, categorie, cod, validat, tva,
  };
}

/**
 * Internal accumulator that runs the Saga journal business logic against a
 * generic sequence of row dicts. Used by both the streaming entry point
 * (production: yauzl + sax) and the legacy buffer entry point (kept only as
 * a thin compatibility wrapper for any test that still passes a Buffer).
 */
type RowDict = Record<string, unknown>;

interface ResolverState {
  resolved: Record<string, string>;
  hasCat: boolean;
  hasCod: boolean;
  hasVal: boolean;
  hasTva: boolean;
  hasNames: boolean;
}

function buildResolverState(rawHeaders: string[]): { state: ResolverState; missing: string[] } {
  const { resolved } = resolveHeaders(rawHeaders);
  const required = ["data", "cont_d", "cont_c", "suma", "explicatie"] as const;
  const missing = required.filter((col) => !resolved[col]);
  return {
    state: {
      resolved,
      hasCat: !!resolved["categorie"],
      hasCod: !!resolved["cod"],
      hasVal: !!resolved["validat"],
      hasTva: !!resolved["tva"],
      hasNames: !!(resolved["denumire_d"] || resolved["denumire_c"] || resolved["denumire"]),
    },
    missing,
  };
}

const COLUMN_LABELS: Record<string, string> = {
  data: "Data",
  cont_d: "Cont Debit",
  cont_c: "Cont Credit",
  suma: "Suma",
  explicatie: "Explicatie",
};

class JournalAccumulator {
  readonly entries: JournalEntry[] = [];
  readonly errors: ParseError[] = [];
  readonly yearSet = new Set<number>();
  readonly accountNames = new Map<string, string>();
  readonly state: ResolverState;
  private compoundDebitStack: Compound[] = [];
  private compoundCreditStack: Compound[] = [];
  private orphanBuffer: OrphanDetail[] = [];
  totalRaw = 0;

  constructor(state: ResolverState) {
    this.state = state;
  }

  ingest(row: RowDict): void {
    this.totalRaw++;
    const { state } = this;
    const get = (col: string): unknown => {
      const key = state.resolved[col];
      return key ? row[key] : undefined;
    };
    const getStr = (col: string): string => {
      const val = get(col);
      return val !== null && val !== undefined ? String(val).trim() : "";
    };

    const dateVal = parseDate(get("data"));
    if (!dateVal) return;

    const dKey = dateKeyLocal(dateVal);
    let contD = getStr("cont_d");
    let contC = getStr("cont_c");
    const suma = normalizeMoney(get("suma"));
    const ndp = getStr("ndp");
    const explicatie = normalizeText(getStr("explicatie"));
    const felD = getStr("fel_d");
    const categorie = state.hasCat ? getStr("categorie") || null : null;
    const cod = state.hasCod ? getStr("cod") || null : null;
    const validat = state.hasVal ? getStr("validat") || null : null;
    const tva = state.hasTva
      ? (() => {
          const r = get("tva");
          return r === "" || r === null || r === undefined ? null : normalizeMoney(r);
        })()
      : null;

    if (state.hasNames) {
      const dd = getStr("denumire_d");
      const dc = getStr("denumire_c");
      const dn = getStr("denumire");
      if (dd && contD && contD !== "%") this.accountNames.set(contD, dd);
      if (dc && contC && contC !== "%") this.accountNames.set(contC, dc);
      if (dn && !dd && !dc) {
        if (contD && contD.includes(".") && contD !== "%") this.accountNames.set(contD, dn);
        if (contC && contC.includes(".") && contC !== "%") this.accountNames.set(contC, dn);
      }
    }

    if (!contD && !contC) return;

    clearStaleCompounds(this.compoundDebitStack, dKey);
    clearStaleCompounds(this.compoundCreditStack, dKey);
    if (this.orphanBuffer.length > 0 && this.orphanBuffer[0].dKey !== dKey) {
      this.orphanBuffer.length = 0;
    }

    const isDetailDebitMissing = !contD && contC && contC !== "%";
    const isDetailCreditMissing = contD && contD !== "%" && !contC;

    if (contC === "%" && contD && contD !== "%") {
      const compound = { fixedAccount: contD, dateKey: dKey, detailsUsed: 0, explicatie };
      this.compoundDebitStack.push(compound);
      this.flushOrphans("debit", compound);
      return;
    }
    if (contD === "%" && contC && contC !== "%") {
      const compound = { fixedAccount: contC, dateKey: dKey, detailsUsed: 0, explicatie };
      this.compoundCreditStack.push(compound);
      this.flushOrphans("credit", compound);
      return;
    }
    if (contD === "%" && contC === "%") return;

    if (isDetailDebitMissing) {
      const c = findCompound(this.compoundDebitStack, dKey, explicatie);
      if (c) {
        contD = c.fixedAccount;
        c.detailsUsed += 1;
      }
    } else if (isDetailCreditMissing) {
      const c = findCompound(this.compoundCreditStack, dKey, explicatie);
      if (c) {
        contC = c.fixedAccount;
        c.detailsUsed += 1;
      }
    }

    if (!contD && contC) {
      this.orphanBuffer.push({
        dateVal, dKey, contD: "", contC, suma, ndp, explicatie, felD,
        categorie, cod, validat, tva, needs: "debit",
      });
      return;
    }
    if (!contC && contD) {
      this.orphanBuffer.push({
        dateVal, dKey, contD, contC: "", suma, ndp, explicatie, felD,
        categorie, cod, validat, tva, needs: "credit",
      });
      return;
    }

    if (!contD || !contC) return;

    this.yearSet.add(dateVal.getFullYear());
    this.entries.push(
      makeEntry(dateVal, ndp, contD, contC, suma, explicatie, felD, categorie, cod, validat, tva)
    );
  }

  private flushOrphans(kind: "debit" | "credit", compound: Compound): void {
    for (let j = this.orphanBuffer.length - 1; j >= 0; j--) {
      const o = this.orphanBuffer[j];
      if (o.dKey !== compound.dateKey || o.needs !== kind) continue;
      if (compound.explicatie && o.explicatie && compound.explicatie !== o.explicatie) continue;
      const cd = kind === "debit" ? compound.fixedAccount : o.contD;
      const cc = kind === "credit" ? compound.fixedAccount : o.contC;
      this.yearSet.add(o.dateVal.getFullYear());
      this.entries.push(
        makeEntry(o.dateVal, o.ndp, cd, cc, o.suma, o.explicatie, o.felD, o.categorie, o.cod, o.validat, o.tva)
      );
      this.orphanBuffer.splice(j, 1);
    }
  }

  finalize(): JournalParseResult {
    applyPostClosingShift(this.entries, this.yearSet);
    return {
      entries: this.entries,
      years: [...this.yearSet].sort((a, b) => a - b),
      errors: this.errors,
      totalRaw: this.totalRaw,
      accountNames: this.accountNames,
    };
  }
}

type Compound = { fixedAccount: string; dateKey: string; detailsUsed: number; explicatie: string };
type OrphanDetail = {
  dateVal: Date;
  dKey: string;
  contD: string;
  contC: string;
  suma: number;
  ndp: string;
  explicatie: string;
  felD: string;
  categorie: string | null;
  cod: string | null;
  validat: string | null;
  tva: number | null;
  needs: "debit" | "credit";
};

function findCompound(stack: Compound[], dKey: string, explicatie: string): Compound | null {
  if (stack.length === 0) return null;
  const isClosingDetail = /Inchidere\s+luna/i.test(explicatie);
  for (let j = stack.length - 1; j >= 0; j--) {
    const c = stack[j];
    if (c.dateKey !== dKey) continue;
    if (explicatie && c.explicatie === explicatie) return c;
  }
  if (isClosingDetail) return null;
  for (let j = stack.length - 1; j >= 0; j--) {
    const c = stack[j];
    if (c.dateKey === dKey) return c;
  }
  return null;
}

function clearStaleCompounds(stack: Compound[], dKey: string): void {
  for (let j = stack.length - 1; j >= 0; j--) {
    if (stack[j].dateKey !== dKey) stack.splice(j, 1);
  }
}

/**
 * Streaming parser. Production entry point. Memory stays around 45 MB peak
 * regardless of file size; a 200k-row Saga export streams in ~18 s instead
 * of OOM-segfaulting the pod.
 */
export async function parseJournalXLSXStreaming(
  source: string | Buffer
): Promise<JournalParseResult> {
  // Mutable holder so the assignment inside `consumeRow` is observable to
  // TypeScript's control-flow analysis after the callback returns.
  const holder: { acc: JournalAccumulator | null } = { acc: null };
  let headerRowSeen = false;
  let headerKeys: string[] = [];

  const consumeRow = (sagaRow: SagaRow) => {
    if (!headerRowSeen) {
      headerRowSeen = true;
      const headerByCol = new Map<number, string>();
      for (const cell of sagaRow.cells) {
        if (cell.value) headerByCol.set(cell.col, cell.value);
      }
      // Materialize a stable ordered list of header names so subsequent
      // rows produce dicts with the same keys the resolver expects.
      const maxCol = Math.max(...headerByCol.keys(), 0);
      headerKeys = [];
      for (let c = 0; c <= maxCol; c++) headerKeys.push(headerByCol.get(c) ?? "");

      const { state, missing } = buildResolverState(headerKeys.filter((k) => k));
      const acc = new JournalAccumulator(state);
      if (missing.length > 0) {
        acc.errors.push({
          row: 0,
          message: `Coloane obligatorii lipsa: ${missing.map((c) => COLUMN_LABELS[c] ?? c).join(", ")}`,
        });
      }
      holder.acc = acc;
      return;
    }

    const current = holder.acc;
    if (!current || current.errors.length > 0) return;

    const dict: RowDict = {};
    const dateKey = current.state.resolved["data"];
    for (const cell of sagaRow.cells) {
      const key = headerKeys[cell.col];
      if (!key) continue;
      // Date column needs to keep its Excel-serial number so parseDate()
      // hits the SSF.parse_date_code path. Everything else is a string.
      dict[key] = key === dateKey ? maybeSerialDate(cell.value) : cell.value;
    }
    current.ingest(dict);
  };

  await streamSagaSheet(source, consumeRow);

  const acc = holder.acc;
  if (!acc) {
    return emptyResult([{ row: 0, message: "Sheet-ul este gol" }]);
  }
  if (acc.errors.length > 0) {
    return emptyResult(acc.errors);
  }
  return acc.finalize();
}

/**
 * Legacy buffer parser. Kept for two reasons:
 *   1. Backward compatibility with any caller that still passes a Buffer
 *      and expects a synchronous result.
 *   2. As a reference implementation we can cross-check the streaming
 *      parser against in tests.
 *
 * Production code paths now call `parseJournalXLSXStreaming` instead — see
 * `src/modules/ingestion/service.ts`.
 */
export function parseJournalXLSX(buffer: Buffer): JournalParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return emptyResult([{ row: 0, message: "Fisierul nu contine niciun sheet" }]);

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (data.length === 0) return emptyResult([{ row: 0, message: "Sheet-ul este gol" }]);

  const rawHeaders = Object.keys(data[0]);
  const { state, missing } = buildResolverState(rawHeaders);
  if (missing.length > 0) {
    return emptyResult([{
      row: 0,
      message: `Coloane obligatorii lipsa: ${missing.map((c) => COLUMN_LABELS[c] ?? c).join(", ")}`,
    }]);
  }

  const acc = new JournalAccumulator(state);
  for (const row of data) acc.ingest(row);
  return acc.finalize();
}

function applyPostClosingShift(entries: JournalEntry[], yearSet: Set<number>): void {
  const closingDates = new Map<string, number>();
  for (const e of entries) {
    if (/inchidere\s+luna/i.test(e.explicatie)) {
      const key = `${e.year}-${e.month}`;
      const day = e.data.getDate();
      const prev = closingDates.get(key) ?? 0;
      if (day > prev) closingDates.set(key, day);
    }
  }

  if (closingDates.size === 0) return;

  yearSet.clear();
  for (const e of entries) {
    const closingDay = closingDates.get(`${e.year}-${e.month}`);
    if (closingDay !== undefined && e.data.getDate() > closingDay) {
      if (e.month === 12) { e.year += 1; e.month = 1; }
      else { e.month += 1; }
    }
    yearSet.add(e.year);
  }
}

function emptyResult(errors: ParseError[]): JournalParseResult {
  return { entries: [], years: [], errors, totalRaw: 0, accountNames: new Map() };
}
