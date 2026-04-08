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

  let compound: { fixedAccount: string; side: "debit" | "credit"; dateKey: string } | null = null;

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
    if (compound && compound.dateKey !== dKey) compound = null;

    // Compound header: one side is "%"
    if (contC === "%" && contD && contD !== "%") {
      compound = { fixedAccount: contD, side: "debit", dateKey: dKey };
      continue;
    }
    if (contD === "%" && contC && contC !== "%") {
      compound = { fixedAccount: contC, side: "credit", dateKey: dKey };
      continue;
    }
    if (contD === "%" && contC === "%") continue;

    // Detail rows: fill in missing side from compound context
    if (compound && compound.dateKey === dKey) {
      if (compound.side === "debit" && contC && (!contD || contD === "%")) {
        contD = compound.fixedAccount;
      } else if (compound.side === "credit" && contD && (!contC || contC === "%")) {
        contC = compound.fixedAccount;
      }
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
