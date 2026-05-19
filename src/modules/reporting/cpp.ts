/**
 * Simplified CPP view, derived directly from `computeCppF20` so the two
 * surfaces of the same financial reality cannot diverge by construction.
 *
 * The Detailed view (F20) is the source of truth — it follows the official
 * OMF 2036/2025 layout exactly, with its sign rules, dual rows, and tax
 * regime routing. The Simplified view is a per-account collapse of the
 * same compute output: same accounts, same values, same totals, fewer
 * rows on screen.
 *
 * If you need to fix the math, fix it once in cpp-f20.ts.
 */
import type { BalanceRowView } from "@/modules/balances";
import type { CatalogAccount, TaxRegime } from "@/modules/accounts";
import { loadCatalogSync } from "@/modules/accounts";
import { computeCppF20 } from "./cpp-f20";
import type { CppData, CppF20Line, CppLine } from "./types";

export interface CppOptions {
  /** D13: which accounts map to the impozit line. Defaults to all profit-tax accounts. */
  taxRegime?: TaxRegime;
}

interface SectionSpec {
  header: string;
  /** F20 row numbers that constitute this section in the simplified view. */
  rowNumbers: string[];
  /** Total label shown after the per-account rows. */
  totalLabel: string;
}

const SECTIONS: SectionSpec[] = [
  {
    header: "VENITURI DIN EXPLOATARE",
    // Section A + B detail rows. Subtotals (01, 16) and info (02, 14, 15)
    // are skipped — we walk only leaves that carry accounts.
    rowNumbers: ["03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"],
    totalLabel: "Total venituri din exploatare",
  },
  {
    header: "CHELTUIELI DIN EXPLOATARE",
    // Section C detail leaves only. Subtotals (24, 27, 31, 34, 51, 54) and
    // info rows (20, 21, 37-39, 41, 43, 45, 30, 33) are skipped.
    rowNumbers: [
      "17", "18", "19", "22", "23",
      "25", "26",
      "28", "29", "32",
      "35", "36", "40", "42", "44", "46", "47", "48", "49", "50",
      "52", "53",
    ],
    totalLabel: "Total cheltuieli din exploatare",
  },
  {
    header: "VENITURI FINANCIARE",
    rowNumbers: ["57", "59", "61", "62"],
    totalLabel: "Total venituri financiare",
  },
  {
    header: "CHELTUIELI FINANCIARE",
    // rd.65 is a subtotal (rd.66 - rd.67); leaves are 66/67/68/70.
    rowNumbers: ["66", "67", "68", "70"],
    totalLabel: "Total cheltuieli financiare",
  },
];

const TAX_ROWS = ["78", "79", "80", "81", "82"];

export function computeCpp(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>,
  options: CppOptions = {}
): CppData {
  const cat = catalog ?? loadCatalogSync();
  const f20 = computeCppF20(rows, cat, options);
  const byRow = new Map(f20.lines.map((l) => [l.rowNumber, l]));
  const perCode = aggregatePerCode(rows, cat);

  const lines: CppLine[] = [];

  // Build the four operating + financial sections from F20 detail rows.
  for (const section of SECTIONS) {
    pushSection(section, byRow, perCode, cat, lines);
  }

  lines.push(totalLine("REZULTAT DIN EXPLOATARE", f20.rezultatExploatare));
  lines.push(totalLine("REZULTAT FINANCIAR", f20.rezultatFinanciar));
  lines.push(totalLine("REZULTAT BRUT", f20.rezultatBrut));

  // Tax line — show every contributing tax account on its own line so the
  // accountant sees exactly which tax account drove the rezultat net.
  for (const rn of TAX_ROWS) {
    const taxRow = byRow.get(rn);
    if (!taxRow || taxRow.value === 0) continue;
    for (const code of taxRow.accounts ?? []) {
      const agg = perCode.get(code);
      if (!agg || agg.td === 0) continue;
      const meta = cat.get(code);
      lines.push({
        cont: code,
        denumire: getTaxLabel(code, meta),
        indent: 0,
        isHeader: false,
        isTotal: false,
        value: round2(agg.td),
      });
    }
  }

  lines.push(totalLine("REZULTAT NET", f20.rezultatNet));

  return {
    lines,
    venituriExploatare: f20.venituriExploatare,
    cheltuieliExploatare: f20.cheltuieliExploatare,
    rezultatExploatare: f20.rezultatExploatare,
    venituriFinanciare: f20.venituriFinanciare,
    cheltuieliFinanciare: f20.cheltuieliFinanciare,
    rezultatFinanciar: f20.rezultatFinanciar,
    rezultatBrut: f20.rezultatBrut,
    rezultatNet: f20.rezultatNet,
  };
}

interface PerCodeAgg {
  td: number;
  tc: number;
}

/**
 * Aggregate rulajTD/TC per catalog code, mirroring what cpp-f20.ts does
 * internally. Needed so the simplified view can render per-account lines
 * using the same numbers F20 used.
 */
function aggregatePerCode(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): Map<string, PerCodeAgg> {
  const agg = new Map<string, PerCodeAgg>();
  for (const row of rows.filter((r) => r.isLeaf)) {
    if (row.contBase === "121" || row.contBase === "1211" || row.contBase === "1212") continue;
    const code = resolveCatalogCode(row.contBase, catalog);
    if (!code) continue;
    const prev = agg.get(code) ?? { td: 0, tc: 0 };
    prev.td += row.rulajTD;
    prev.tc += row.rulajTC;
    agg.set(code, prev);
  }
  return agg;
}

function resolveCatalogCode(
  contBase: string,
  catalog: Map<string, CatalogAccount>
): string | null {
  if (catalog.has(contBase)) return contBase;
  for (let len = contBase.length - 1; len >= 2; len--) {
    const prefix = contBase.slice(0, len);
    if (catalog.has(prefix)) return prefix;
  }
  return null;
}

/**
 * Emit one section: header row, one row per contributing account, and a
 * section total. Contributing accounts are exactly those that appeared on
 * the F20 detail rows belonging to this section — guaranteeing that the
 * displayed per-account values sum to the F20 section total.
 */
function pushSection(
  section: SectionSpec,
  byRow: Map<string, CppF20Line>,
  perCode: Map<string, PerCodeAgg>,
  catalog: Map<string, CatalogAccount>,
  lines: CppLine[]
): void {
  // Collect contributing accounts with their signed value, deduped across
  // F20 rows. A code can appear on only one DETAIL row in a section (info
  // rows are skipped, dual-row split is sign-aware) so a Map keyed by code
  // gives one entry per visible account.
  interface Entry {
    code: string;
    label: string;
    value: number;
  }
  const entries = new Map<string, Entry>();
  let sectionTotal = 0;

  for (const rn of section.rowNumbers) {
    const row = byRow.get(rn);
    if (!row || row.kind !== "detail") continue;
    if (!row.accounts || row.accounts.length === 0) continue;

    // The F20 row's value is the signed contribution of all its accounts
    // to the section total. We distribute it back per code using each
    // code's natural-side rulaj, falling back to even split only if the
    // signs don't align (shouldn't happen in practice).
    const isDebitRow = isDebitSection(section);
    for (const code of row.accounts) {
      const agg = perCode.get(code);
      if (!agg) continue;
      const sideValue = isDebitRow ? agg.td : agg.tc;
      if (sideValue === 0) continue;
      // For rows that subtract (rd.05 reduceri acordate has sign='-'),
      // the contribution to the section is negative.
      const signed = signForRow(row) * sideValue;
      const meta = catalog.get(code);
      const label = meta?.cppLabel ?? meta?.name ?? code;
      const existing = entries.get(code);
      if (existing) {
        existing.value += signed;
      } else {
        entries.set(code, { code, label, value: signed });
      }
      sectionTotal += signed;
    }
  }

  if (entries.size === 0) return;

  lines.push({
    cont: "",
    denumire: section.header,
    indent: 0,
    isHeader: true,
    isTotal: false,
    value: 0,
  });

  const sorted = [...entries.values()].sort((a, b) => a.code.localeCompare(b.code));
  for (const e of sorted) {
    lines.push({
      cont: e.code,
      denumire: e.label,
      indent: 1,
      isHeader: false,
      isTotal: false,
      value: round2(e.value),
    });
  }

  lines.push(totalLine(section.totalLabel, round2(sectionTotal)));
}

function isDebitSection(section: SectionSpec): boolean {
  return section.header.startsWith("CHELTUIELI");
}

function signForRow(row: CppF20Line): 1 | -1 {
  // The F20 line itself carries the structural sign via the JSON's `sign`
  // field, which buildLine doesn't surface on CppF20Line. We infer it from
  // the well-known subtraction rows: rd.05 (709 reduceri acordate) and
  // rd.23 (609 reduceri primite) flip sign within their section.
  if (row.rowNumber === "05" || row.rowNumber === "23") return -1;
  return 1;
}

function getTaxLabel(code: string, meta: CatalogAccount | undefined): string {
  switch (code) {
    case "691":
      return "Impozit pe profit";
    case "694":
      return "Impozit pe profit (grup)";
    case "695":
      return "Impozit specific";
    case "697":
      return "Impozit minim pe cifra de afaceri (IMCA)";
    case "698":
      return "Impozit pe venit microintreprindere";
    default:
      return meta?.name ?? "Impozit";
  }
}

function totalLine(label: string, value: number): CppLine {
  return { cont: "", denumire: label, indent: 0, isHeader: false, isTotal: true, value };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
