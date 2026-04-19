/**
 * D17 — Detailed F20 CPP view per OMFP 1802 Anexa 3.
 *
 * Pure function. Consumes the same BalanceRowView[] as computeCpp (the
 * simplified view), but groups by F20 row number from seeds/f20-structure.json
 * instead of by the coarse 4-bucket CppGroup.
 *
 * This runs alongside computeCpp — one pipeline, two presentations.
 * Totals reconcile: the F20 rezultat brut/net equals the simplified
 * rezultat brut/net (enforced by a reconciliation test).
 *
 * Resolution priority for "which F20 row does a balance row feed":
 *   1. catalog[contBase].cppLine (direct).
 *   2. Walk up catalog prefixes until one has cppLine (e.g. 6022 → 602 → rd.13a).
 *   3. If the contBase is referenced explicitly in the F20 structure's
 *      detail accounts (legacy path for codes not in the catalog), use that.
 *   4. Otherwise, ignored.
 */

import type { BalanceRowView } from "@/modules/balances";
import {
  loadCatalogSync,
  type CatalogAccount,
  type TaxRegime,
} from "@/modules/accounts";
import {
  loadF20Structure,
  isDetailRow,
  type F20DetailRow,
  type F20Structure,
} from "./f20-structure";
import type { CppF20Data, CppF20Line } from "./types";

/** Accounts that appear on two F20 rows — split by sign at compute time. */
const DUAL_ROW_ACCOUNTS: Record<string, { positive: string; negative: string }> = {
  "711": { positive: "07", negative: "08" },
  "712": { positive: "07", negative: "08" },
};

const DUAL_CODES = new Set(Object.keys(DUAL_ROW_ACCOUNTS));
const DUAL_TARGET_ROWS = new Set<string>(
  Object.values(DUAL_ROW_ACCOUNTS).flatMap((s) => [s.positive, s.negative])
);

/** Per-regime allowed accounts for rd.34 Impozit (mirrors D13). */
const TAX_REGIME_ACCOUNTS: Record<TaxRegime, string[]> = {
  profit_standard: ["691"],
  profit_micro_1: ["698"],
  profit_micro_3: ["698"],
  profit_specific: ["695"],
  imca: ["697"],
  deferred: ["698"],
};

export interface CppF20Options {
  taxRegime?: TaxRegime;
}

interface PerCodeAgg {
  td: number;
  tc: number;
}

export function computeCppF20(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>,
  options: CppF20Options = {}
): CppF20Data {
  const cat = catalog ?? loadCatalogSync();
  const structure = loadF20Structure();
  const leafRows = rows.filter((r) => r.isLeaf);

  // Per catalog code, accumulate rulajTD/TC across all balance rows that
  // resolve to it. This lets us split dual-row accounts and filter by tax
  // regime without re-reading the balance.
  const perCode = aggregatePerCatalogCode(leafRows, cat);

  // Map: catalog code -> F20 row. Walks prefix chain for codes without
  // their own cppLine (e.g. 6022 inherits 602's "13a").
  const codeToRow = buildCodeToRowMap(structure, cat);

  // Compute detail rows.
  const rowValues = new Map<string, number>();
  const rowAccounts = new Map<string, Set<string>>();

  for (const row of structure.rows) {
    if (!isDetailRow(row)) continue;
    const { value, accounts } = computeDetailRow(row, perCode, codeToRow, options.taxRegime);
    rowValues.set(row.rowNumber, value);
    rowAccounts.set(row.rowNumber, accounts);
  }

  // Evaluate subtotals/totals in document order.
  for (const row of structure.rows) {
    if (isDetailRow(row)) continue;
    rowValues.set(row.rowNumber, evaluateFormula(row.formula, rowValues));
  }

  const lines: CppF20Line[] = structure.rows.map((row) => buildLine(row, rowValues, rowAccounts));
  const val = (rn: string): number => round2(rowValues.get(rn) ?? 0);

  return {
    version: structure.version,
    lines,
    venituriExploatare: val("12"),
    cheltuieliExploatare: val("19"),
    rezultatExploatare: val("20"),
    venituriFinanciare: val("25"),
    cheltuieliFinanciare: val("29"),
    rezultatFinanciar: val("30"),
    venituriTotale: val("31"),
    cheltuieliTotale: val("32"),
    rezultatBrut: val("33"),
    rezultatNet: val("35"),
  };
}

/**
 * For each leaf balance row, resolve its contBase to a catalog code
 * (following the prefix chain), then accumulate rulajTD/TC under that
 * code. If no catalog code matches, the row is ignored.
 *
 * Excludes 121, 1211, 1212 (closing accounts).
 */
function aggregatePerCatalogCode(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): Map<string, PerCodeAgg> {
  const agg = new Map<string, PerCodeAgg>();
  for (const row of rows) {
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
 * Build catalog code -> F20 row mapping.
 *   1. Start with direct catalog.cppLine.
 *   2. For codes without cppLine, inherit from the nearest prefix that has one.
 *   3. Accounts in the F20 structure that are not in the catalog at all
 *      still resolve (legacy fallback).
 */
function buildCodeToRowMap(
  structure: F20Structure,
  catalog: Map<string, CatalogAccount>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [code, cat] of catalog) {
    if (cat.cppLine) map.set(code, cat.cppLine);
  }
  for (const [code, cat] of catalog) {
    if (cat.cppLine) continue;
    for (let len = code.length - 1; len >= 2; len--) {
      const prefix = code.slice(0, len);
      const ancestor = catalog.get(prefix);
      if (ancestor?.cppLine) {
        map.set(code, ancestor.cppLine);
        break;
      }
    }
  }
  for (const row of structure.rows) {
    if (!isDetailRow(row)) continue;
    for (const acc of row.accounts) {
      if (!map.has(acc)) map.set(acc, row.rowNumber);
    }
  }
  return map;
}

function computeDetailRow(
  row: F20DetailRow,
  perCode: Map<string, PerCodeAgg>,
  codeToRow: Map<string, string>,
  regime: TaxRegime | undefined
): { value: number; accounts: Set<string> } {
  // Dual target rows: sum by sign over the dual codes only.
  if (DUAL_TARGET_ROWS.has(row.rowNumber)) {
    return computeDualTargetRow(row.rowNumber, perCode);
  }

  // rd.34 Impozit with regime filter.
  if (row.rowNumber === "34" && regime) {
    return computeTaxRowForRegime(regime, perCode);
  }

  // Standard: find every catalog code that maps to this row and sum.
  const contributing = new Set<string>();
  let total = 0;
  for (const [code, mappedRow] of codeToRow) {
    if (mappedRow !== row.rowNumber) continue;
    // Dual codes are handled by DUAL_TARGET_ROWS branch above.
    if (DUAL_CODES.has(code)) continue;
    const agg = perCode.get(code);
    if (!agg) continue;
    const amount = row.side === "D" ? agg.td : agg.tc;
    if (amount === 0) continue;
    total += amount;
    contributing.add(code);
  }
  return { value: round2(total), accounts: contributing };
}

function computeDualTargetRow(
  rowNumber: string,
  perCode: Map<string, PerCodeAgg>
): { value: number; accounts: Set<string> } {
  const contributing = new Set<string>();
  let total = 0;
  for (const [code, split] of Object.entries(DUAL_ROW_ACCOUNTS)) {
    const agg = perCode.get(code);
    if (!agg) continue;
    const net = agg.tc - agg.td;
    if (rowNumber === split.positive && net > 0) {
      total += net;
      contributing.add(code);
    } else if (rowNumber === split.negative && net < 0) {
      total += -net;
      contributing.add(code);
    }
  }
  return { value: round2(total), accounts: contributing };
}

function computeTaxRowForRegime(
  regime: TaxRegime,
  perCode: Map<string, PerCodeAgg>
): { value: number; accounts: Set<string> } {
  const allowed = TAX_REGIME_ACCOUNTS[regime];
  const contributing = new Set<string>();
  let total = 0;
  for (const code of allowed) {
    const agg = perCode.get(code);
    if (!agg) continue;
    // Use rulajTD only — same as all expense accounts. Using
    // td − tc nets to zero when monthly closing entries mirror
    // the original charge (D:691 C:121 → both sides equal).
    if (agg.td === 0) continue;
    total += agg.td;
    contributing.add(code);
  }
  return { value: round2(total), accounts: contributing };
}

/**
 * Evaluate a formula string like "rd.13a + rd.13b - rd.13e" against the
 * accumulated row values. Tiny safe parser — no eval.
 */
export function evaluateFormula(
  formula: string,
  rowValues: Map<string, number>
): number {
  const tokens = formula.match(/[+-]?\s*rd\.[0-9a-z]+/g);
  if (!tokens) return 0;
  let total = 0;
  for (const raw of tokens) {
    const sign = raw.trim().startsWith("-") ? -1 : 1;
    const rowRef = raw.replace(/[+\-\s]/g, "").replace("rd.", "");
    const value = rowValues.get(rowRef) ?? 0;
    total += sign * value;
  }
  return round2(total);
}

function buildLine(
  row: F20Structure["rows"][number],
  rowValues: Map<string, number>,
  rowAccounts: Map<string, Set<string>>
): CppF20Line {
  const value = round2(rowValues.get(row.rowNumber) ?? 0);
  if (isDetailRow(row)) {
    const accs = rowAccounts.get(row.rowNumber);
    return {
      rowNumber: row.rowNumber,
      label: row.label,
      section: row.section,
      indent: row.indent,
      kind: "detail",
      value,
      accounts: accs && accs.size > 0 ? [...accs].sort() : undefined,
    };
  }
  return {
    rowNumber: row.rowNumber,
    label: row.label,
    section: row.section,
    indent: row.indent,
    kind: row.kind,
    value,
    formula: row.formula,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
