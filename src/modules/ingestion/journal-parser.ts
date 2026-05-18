import * as XLSX from "xlsx";
import { normalizeMoney } from "@/lib/money";
import { getContBase } from "@/lib/accounts";
import { resolveHeaders } from "./header-resolver";
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
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value.trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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

export function parseJournalXLSX(buffer: Buffer): JournalParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return emptyResult([{ row: 0, message: "Fisierul nu contine niciun sheet" }]);

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (data.length === 0) return emptyResult([{ row: 0, message: "Sheet-ul este gol" }]);

  const rawHeaders = Object.keys(data[0]);
  const { resolved } = resolveHeaders(rawHeaders);

  const required = ["data", "cont_d", "cont_c", "suma"] as const;
  const missing = required.filter((col) => !resolved[col]);
  const COLUMN_LABELS: Record<string, string> = { data: "Data", cont_d: "Cont Debit", cont_c: "Cont Credit", suma: "Suma" };
  if (missing.length > 0) return emptyResult([{ row: 0, message: `Coloane obligatorii lipsa: ${missing.map((c) => COLUMN_LABELS[c] ?? c).join(", ")}` }]);

  const entries: JournalEntry[] = [];
  const errors: ParseError[] = [];
  const yearSet = new Set<number>();
  const accountNames = new Map<string, string>();

  const hasCat = !!resolved["categorie"];
  const hasCod = !!resolved["cod"];
  const hasVal = !!resolved["validat"];
  const hasTva = !!resolved["tva"];
  const hasNames = !!(resolved["denumire_d"] || resolved["denumire_c"] || resolved["denumire"]);

  const get = (row: Record<string, unknown>, col: string): unknown => {
    const key = resolved[col];
    return key ? row[key] : undefined;
  };
  const getStr = (row: Record<string, unknown>, col: string): string => {
    const val = get(row, col);
    return val !== null && val !== undefined ? String(val).trim() : "";
  };

  // A single date may carry two compound headers (one fixing the debit side,
  // one fixing the credit side) — e.g. monthly closing entries: "121 = %" for
  // expenses and "% = 121" for revenues. Saga sometimes emits both back-to-back
  // before any detail row, with the detail rows interleaved later. We must
  // track both and pick the matching one for each detail row by looking at
  // which side of the detail row is empty.
  //
  // We also accept "orphan" detail rows that appear BEFORE the compound header
  // on the same date (rare but seen in Saga exports). They are buffered and
  // dispensed retroactively once the matching header arrives.
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
  // Stacks of active compounds per side. A date can have multiple compounds
  // of the same side interleaved (e.g. salary-block + closing-block both with
  // 421/121 as debit fixed account). When picking a compound for a detail row,
  // we prefer one whose explicatie matches the detail's, falling back to the
  // most recently added one.
  const compoundDebitStack: Compound[] = [];
  const compoundCreditStack: Compound[] = [];
  const orphanBuffer: OrphanDetail[] = [];

  const findCompound = (stack: Compound[], dKey: string, explicatie: string): Compound | null => {
    if (stack.length === 0) return null;
    // Closing details ("Inchidere luna XYZ") MUST tie to a compound with the
    // exact same explicatie — never fall back.
    const isClosingDetail = /Inchidere\s+luna/i.test(explicatie);
    for (let j = stack.length - 1; j >= 0; j--) {
      const c = stack[j];
      if (c.dateKey !== dKey) continue;
      if (explicatie && c.explicatie === explicatie) return c;
    }
    if (isClosingDetail) return null;
    // For non-closing details, fall back to the most recent compound on this date
    for (let j = stack.length - 1; j >= 0; j--) {
      const c = stack[j];
      if (c.dateKey === dKey) return c;
    }
    return null;
  };

  const clearStaleCompounds = (stack: Compound[], dKey: string) => {
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].dateKey !== dKey) stack.splice(j, 1);
    }
  };

  const flushOrphans = (kind: "debit" | "credit", compound: Compound) => {
    for (let j = orphanBuffer.length - 1; j >= 0; j--) {
      const o = orphanBuffer[j];
      if (o.dKey !== compound.dateKey || o.needs !== kind) continue;
      if (compound.explicatie && o.explicatie && compound.explicatie !== o.explicatie) continue;
      const cd = kind === "debit" ? compound.fixedAccount : o.contD;
      const cc = kind === "credit" ? compound.fixedAccount : o.contC;
      yearSet.add(o.dateVal.getFullYear());
      entries.push(makeEntry(o.dateVal, o.ndp, cd, cc, o.suma, o.explicatie, o.felD, o.categorie, o.cod, o.validat, o.tva));
      orphanBuffer.splice(j, 1);
    }
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2;
    const dateVal = parseDate(get(row, "data"));
    if (!dateVal) continue;

    const dKey = dateKeyLocal(dateVal);
    let contD = getStr(row, "cont_d");
    let contC = getStr(row, "cont_c");
    const suma = normalizeMoney(get(row, "suma"));
    const ndp = getStr(row, "ndp");
    const explicatie = normalizeText(getStr(row, "explicatie"));
    const felD = getStr(row, "fel_d");
    const categorie = hasCat ? getStr(row, "categorie") || null : null;
    const cod = hasCod ? getStr(row, "cod") || null : null;
    const validat = hasVal ? getStr(row, "validat") || null : null;
    const tva = hasTva ? (() => { const r = get(row, "tva"); return r === "" || r === null || r === undefined ? null : normalizeMoney(r); })() : null;

    if (hasNames) {
      const dd = getStr(row, "denumire_d");
      const dc = getStr(row, "denumire_c");
      const dn = getStr(row, "denumire");
      if (dd && contD && contD !== "%") accountNames.set(contD, dd);
      if (dc && contC && contC !== "%") accountNames.set(contC, dc);
      if (dn && !dd && !dc) {
        if (contD && contD.includes(".") && contD !== "%") accountNames.set(contD, dn);
        if (contC && contC.includes(".") && contC !== "%") accountNames.set(contC, dn);
      }
    }

    if (!contD && !contC) continue;

    // Clear stale compounds and orphans whose date no longer matches.
    clearStaleCompounds(compoundDebitStack, dKey);
    clearStaleCompounds(compoundCreditStack, dKey);
    if (orphanBuffer.length > 0 && orphanBuffer[0].dKey !== dKey) {
      orphanBuffer.length = 0;
    }

    const isDetailDebitMissing = !contD && contC && contC !== "%";
    const isDetailCreditMissing = contD && contD !== "%" && !contC;

    // Compound header: one side is "%". Push onto the stack and retroactively
    // dispense any orphan details that arrived earlier and match by explicatie.
    if (contC === "%" && contD && contD !== "%") {
      const compound = { fixedAccount: contD, dateKey: dKey, detailsUsed: 0, explicatie };
      compoundDebitStack.push(compound);
      flushOrphans("debit", compound);
      continue;
    }
    if (contD === "%" && contC && contC !== "%") {
      const compound = { fixedAccount: contC, dateKey: dKey, detailsUsed: 0, explicatie };
      compoundCreditStack.push(compound);
      flushOrphans("credit", compound);
      continue;
    }
    if (contD === "%" && contC === "%") continue;

    // Detail rows: pick the compound that best matches by explicatie.
    if (isDetailDebitMissing) {
      const c = findCompound(compoundDebitStack, dKey, explicatie);
      if (c) {
        contD = c.fixedAccount;
        c.detailsUsed += 1;
      }
    } else if (isDetailCreditMissing) {
      const c = findCompound(compoundCreditStack, dKey, explicatie);
      if (c) {
        contC = c.fixedAccount;
        c.detailsUsed += 1;
      }
    }

    // Orphan detail (no matching compound yet): buffer for a later header.
    if (!contD && contC) {
      orphanBuffer.push({
        dateVal, dKey, contD: "", contC, suma, ndp, explicatie, felD,
        categorie, cod, validat, tva, needs: "debit",
      });
      continue;
    }
    if (!contC && contD) {
      orphanBuffer.push({
        dateVal, dKey, contD, contC: "", suma, ndp, explicatie, felD,
        categorie, cod, validat, tva, needs: "credit",
      });
      continue;
    }

    if (!contD || !contC) continue;

    yearSet.add(dateVal.getFullYear());
    entries.push(makeEntry(dateVal, ndp, contD, contC, suma, explicatie, felD, categorie, cod, validat, tva));
  }

  applyPostClosingShift(entries, yearSet);

  return { entries, years: [...yearSet].sort((a, b) => a - b), errors, totalRaw: data.length, accountNames };
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
