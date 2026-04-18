/**
 * Pure CSV export for Plan de Conturi rows.
 *
 * Output format: RFC 4180 CSV, UTF-8, comma delimiter, "
"
 * escaping. Columns in Romanian headers, values monospaced-friendly.
 *
 * Designed so the accountant can open in Excel/Google Sheets with no
 * encoding fuss.
 */

import type { PlanRow } from "./plan";

const HEADERS = [
  "Cont",
  "Denumire",
  "Tip",
  "Clasa",
  "Kind",
  "In catalog OMFP",
  "De revizuit",
  "Sursa nume",
  "Cod partener",
  "Sold final D",
  "Sold final C",
  "Intrari",
  "Prima utilizare",
  "Ultima utilizare",
] as const;

export function planRowsToCsv(rows: PlanRow[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.map(csvCell).join(","));
  for (const row of rows) {
    lines.push(rowToCells(row).map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

function rowToCells(row: PlanRow): string[] {
  return [
    row.cont,
    row.name,
    row.type ?? "",
    row.classDigit !== null ? String(row.classDigit) : "",
    row.kind,
    row.isInCatalog ? "Da" : "Nu",
    row.needsReview ? "Da" : "Nu",
    sourceLabel(row.nameSource),
    row.partnerCode ?? "",
    formatMoney(row.currentSold?.finD),
    formatMoney(row.currentSold?.finC),
    String(row.usage.entriesCount),
    formatDate(row.usage.firstSeen),
    formatDate(row.usage.lastSeen),
  ];
}

function sourceLabel(source: PlanRow["nameSource"]): string {
  switch (source) {
    case "client_edit":
      return "Editat manual";
    case "client_import":
      return "Importat din Saga";
    case "partner_extract":
      return "Extras din explicatie";
    case "omfp_catalog":
      return "OMFP 1802";
    case "fallback":
      return "Nemapat";
  }
}

function formatMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (Math.abs(v) < 0.01) return "";
  // Use dot decimal for CSV — universal, opens cleanly in every locale.
  return v.toFixed(2);
}

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

function csvCell(raw: string): string {
  // Quote only if the value contains delimiter, quote, or newline.
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Filename for the downloaded file, e.g.
 *   plan-conturi_qhm21-network-srl_2025-12.csv
 *   plan-conturi_qhm21-network-srl.csv  (no period)
 */
export function planCsvFilename(clientSlug: string, period?: { year: number; month: number }): string {
  const base = `plan-conturi_${clientSlug}`;
  if (period) {
    const mm = String(period.month).padStart(2, "0");
    return `${base}_${period.year}-${mm}.csv`;
  }
  return `${base}.csv`;
}
