/**
 * D17 — Detailed F20 CPP view per OMF 2036/2025 Anexa 1 (Cod 20).
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
 *   2. Walk up catalog prefixes until one has cppLine (e.g. 6022 → 602 → rd.35).
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

// All runtime knobs (dual-row split, tax regime mapping, summary row refs)
// live in seeds/f20-structure.json and are read fresh per call. This keeps
// the module pure and lets an OMF upgrade ship as a JSON-only change.

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

  // Pre-compute the dual-row index from the structure so detail rows that
  // are dual targets can be summed by sign across the configured account set.
  const dualCodes = new Set<string>();
  const dualTargetRows = new Set<string>();
  for (const dr of structure.dualRowAccounts) {
    for (const c of dr.accounts) dualCodes.add(c);
    dualTargetRows.add(dr.positiveRow);
    dualTargetRows.add(dr.negativeRow);
  }
  const taxRegimeMap = structure.taxRegimeAccounts;
  const taxRows = new Set(Object.values(taxRegimeMap).map((m) => m.row));

  // Compute detail rows.
  const rowValues = new Map<string, number>();
  const rowAccounts = new Map<string, Set<string>>();

  for (const row of structure.rows) {
    if (!isDetailRow(row)) continue;
    const { value, accounts } = computeDetailRow(
      row,
      perCode,
      codeToRow,
      structure,
      dualCodes,
      dualTargetRows,
      taxRows,
      options.taxRegime
    );
    rowValues.set(row.rowNumber, value);
    rowAccounts.set(row.rowNumber, accounts);
  }

  // Evaluate subtotals/totals in document order.
  for (const row of structure.rows) {
    if (isDetailRow(row)) continue;
    rowValues.set(row.rowNumber, evaluateFormula(row.formula, rowValues));
  }

  const lines: CppF20Line[] = structure.rows.map((row) => buildLine(row, rowValues, rowAccounts));
  const summary = computeSummary(structure, rowValues);

  return {
    version: structure.version,
    lines,
    venituriExploatare: summary.venituriExploatare ?? 0,
    cheltuieliExploatare: summary.cheltuieliExploatare ?? 0,
    rezultatExploatare: summary.rezultatExploatare ?? 0,
    venituriFinanciare: summary.venituriFinanciare ?? 0,
    cheltuieliFinanciare: summary.cheltuieliFinanciare ?? 0,
    rezultatFinanciar: summary.rezultatFinanciar ?? 0,
    venituriTotale: summary.venituriTotale ?? 0,
    cheltuieliTotale: summary.cheltuieliTotale ?? 0,
    rezultatBrut: summary.rezultatBrut ?? 0,
    rezultatNet: summary.rezultatNet ?? 0,
  };
}

/**
 * Resolve every summary field declared in the F20 JSON into a single number.
 * - `row` style: direct lookup.
 * - `positiveRow`/`negativeRow` style: signed result for split P&L rows
 *   (OMF 2036/2025 shows profit on one row, loss on a paired row).
 *
 * Any extra fields the JSON adds in the future are exposed automatically.
 */
function computeSummary(
  structure: F20Structure,
  rowValues: Map<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, mapping] of Object.entries(structure.summary)) {
    const get = (rn: string): number => round2(rowValues.get(rn) ?? 0);
    if (mapping.row) {
      out[name] = get(mapping.row);
    } else if (mapping.positiveRow && mapping.negativeRow) {
      out[name] = get(mapping.positiveRow) - get(mapping.negativeRow);
    } else {
      out[name] = 0;
    }
  }
  return out;
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
  structure: F20Structure,
  dualCodes: Set<string>,
  dualTargetRows: Set<string>,
  taxRows: Set<string>,
  regime: TaxRegime | undefined
): { value: number; accounts: Set<string> } {
  // Dual target rows: sum by sign over the dual codes only.
  if (dualTargetRows.has(row.rowNumber)) {
    return computeDualTargetRow(row.rowNumber, perCode, structure);
  }

  // Tax rows with regime filter: when a regime is provided, only the
  // account that regime declares contributes to its target row. Other
  // tax rows render at 0 for that regime.
  if (taxRows.has(row.rowNumber) && regime) {
    return computeTaxRowForRegime(row.rowNumber, regime, perCode, structure);
  }

  // Info rows without a side carry only their declared accounts (they're
  // shown for transparency — "- din care: 7584") and do not contribute to
  // any subtotal, so we sum them honestly using the implicit credit side.
  const summingSide = row.side ?? "C";

  // Standard: find every catalog code that maps to this row and sum.
  const contributing = new Set<string>();
  let total = 0;
  for (const [code, mappedRow] of codeToRow) {
    if (mappedRow !== row.rowNumber) continue;
    // Dual codes are handled by the dual-target branch above.
    if (dualCodes.has(code)) continue;
    const agg = perCode.get(code);
    if (!agg) continue;
    const amount = summingSide === "D" ? agg.td : agg.tc;
    if (amount === 0) continue;
    total += amount;
    contributing.add(code);
  }
  return { value: round2(total), accounts: contributing };
}

function computeDualTargetRow(
  rowNumber: string,
  perCode: Map<string, PerCodeAgg>,
  structure: F20Structure
): { value: number; accounts: Set<string> } {
  const contributing = new Set<string>();
  let total = 0;
  for (const dr of structure.dualRowAccounts) {
    for (const code of dr.accounts) {
      const agg = perCode.get(code);
      if (!agg) continue;
      const net = agg.tc - agg.td;
      if (rowNumber === dr.positiveRow && net > 0) {
        total += net;
        contributing.add(code);
      } else if (rowNumber === dr.negativeRow && net < 0) {
        total += -net;
        contributing.add(code);
      }
    }
  }
  return { value: round2(total), accounts: contributing };
}

function computeTaxRowForRegime(
  rowNumber: string,
  regime: TaxRegime,
  perCode: Map<string, PerCodeAgg>,
  structure: F20Structure
): { value: number; accounts: Set<string> } {
  const mapping = structure.taxRegimeAccounts[regime];
  if (!mapping || mapping.row !== rowNumber) {
    return { value: 0, accounts: new Set() };
  }
  const agg = perCode.get(mapping.account);
  if (!agg || agg.td === 0) return { value: 0, accounts: new Set() };
  return { value: round2(agg.td), accounts: new Set([mapping.account]) };
}

/**
 * Evaluate a formula string like "rd.13a + rd.13b - rd.13e" against the
 * accumulated row values. Tiny safe parser — no eval.
 *
 * Supports a trailing "(cand > 0)" suffix used by paired profit/loss rows
 * (OMF 2036/2025): the value is clamped to >= 0 so the opposite row is the
 * one that carries the signed sister value.
 */
export function evaluateFormula(
  formula: string,
  rowValues: Map<string, number>
): number {
  const clampPositive = /\(\s*cand\s*[>≥]\s*0\s*\)/i.test(formula);
  const tokens = formula.match(/[+-]?\s*rd\.[0-9a-z]+/g);
  if (!tokens) return 0;
  let total = 0;
  for (const raw of tokens) {
    const sign = raw.trim().startsWith("-") ? -1 : 1;
    const rowRef = raw.replace(/[+\-\s]/g, "").replace("rd.", "");
    const value = rowValues.get(rowRef) ?? 0;
    total += sign * value;
  }
  const result = round2(total);
  return clampPositive && result < 0 ? 0 : result;
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
