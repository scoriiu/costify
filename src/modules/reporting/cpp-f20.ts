/**
 * D17 — Detailed F20 CPP view per OMFP 1802 Anexa 3.
 *
 * Pure function. Consumes the same BalanceRowView[] as computeCpp (the
 * simplified view), but groups by F20 row number from seeds/f20-structure.json
 * instead of by the coarse 4-bucket CppGroup.
 *
 * Structure source: seeds/f20-structure.json (loaded via loadF20Structure).
 * Catalog source: AccountCatalog (same as simplified view).
 *
 * This runs alongside computeCpp — one pipeline, two presentations.
 * Totals reconcile: the F20 rezultat brut/net equals the simplified
 * rezultat brut/net (modulo routing edge cases documented inline).
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
  type F20Row,
  type F20DetailRow,
} from "./f20-structure";
import type { CppF20Data, CppF20Line } from "./types";

/** Accounts that appear on two F20 rows — split by sign at compute time. */
const DUAL_ROW_ACCOUNTS: Record<string, { positive: string; negative: string }> = {
  "711": { positive: "07", negative: "08" },
  "712": { positive: "07", negative: "08" },
};

/** Per-regime allowed accounts for rd.34 Impozit (mirrors D13 simplified view). */
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

export function computeCppF20(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>,
  options: CppF20Options = {}
): CppF20Data {
  const cat = catalog ?? loadCatalogSync();
  const structure = loadF20Structure();
  const leafRows = rows.filter((r) => r.isLeaf);

  // Aggregate per base code: D = rulajTD, C = rulajTC.
  const perCode = aggregateByContBase(leafRows, cat);

  // Sum each F20 detail row's value.
  const rowValues = new Map<string, number>();
  const rowAccounts = new Map<string, Set<string>>();

  for (const row of structure.rows) {
    if (!isDetailRow(row)) continue;
    const { value, accounts } = sumDetailRow(row, perCode, options.taxRegime);
    rowValues.set(row.rowNumber, value);
    rowAccounts.set(row.rowNumber, accounts);
  }

  // Now evaluate subtotals/totals in document order.
  for (const row of structure.rows) {
    if (isDetailRow(row)) continue;
    const value = evaluateFormula(row.formula, rowValues);
    rowValues.set(row.rowNumber, value);
  }

  // Build the user-facing line list, hiding zero-valued detail rows for
  // tidiness, but always keeping subtotals/totals visible.
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

interface PerCodeAgg {
  rulajTD: number;
  rulajTC: number;
}

function aggregateByContBase(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): Map<string, PerCodeAgg> {
  const agg = new Map<string, PerCodeAgg>();
  for (const row of rows) {
    if (row.contBase === "121" || row.contBase === "1211" || row.contBase === "1212") continue;
    const base = resolveMappedBase(row, catalog);
    if (!base) continue;
    const prev = agg.get(base) ?? { rulajTD: 0, rulajTC: 0 };
    prev.rulajTD += row.rulajTD;
    prev.rulajTC += row.rulajTC;
    agg.set(base, prev);
  }
  return agg;
}

/**
 * Follow the same logic as the simplified CPP: try the row's own contBase
 * first, then progressively shorter prefixes until we find a catalog entry.
 * Returns the mapped catalog code (not the raw contBase) so aggregation
 * rolls analytics into their synthetic parent.
 */
function resolveMappedBase(
  row: BalanceRowView,
  catalog: Map<string, CatalogAccount>
): string | null {
  const direct = catalog.get(row.contBase);
  if (direct) return direct.code;
  for (let len = row.contBase.length - 1; len >= 2; len--) {
    const prefix = row.contBase.slice(0, len);
    const match = catalog.get(prefix);
    if (match) return match.code;
  }
  return null;
}

function sumDetailRow(
  row: F20DetailRow,
  perCode: Map<string, PerCodeAgg>,
  regime?: TaxRegime
): { value: number; accounts: Set<string> } {
  // rd.34 (impozit) honors tax regime: only the regime's accounts contribute.
  const filterByRegime = row.rowNumber === "34" && regime
    ? new Set(TAX_REGIME_ACCOUNTS[regime])
    : null;

  let total = 0;
  const contributing = new Set<string>();

  for (const code of row.accounts) {
    if (filterByRegime && !filterByRegime.has(code)) continue;
    const agg = perCode.get(code);
    if (!agg) continue;

    const split = DUAL_ROW_ACCOUNTS[code];
    if (split) {
      const net = agg.rulajTC - agg.rulajTD;
      if (row.rowNumber === split.positive) {
        if (net <= 0) continue;
        total += net;
        contributing.add(code);
      } else if (row.rowNumber === split.negative) {
        if (net >= 0) continue;
        total += -net; // positive magnitude on the reducere row
        contributing.add(code);
      }
      continue;
    }

    const amount = row.side === "D" ? agg.rulajTD : agg.rulajTC;
    if (amount === 0) continue;
    total += amount;
    contributing.add(code);
  }

  return { value: round2(total), accounts: contributing };
}

/**
 * Evaluate a formula string like "rd.13a + rd.13b - rd.13e" against the
 * accumulated row values. Intentionally a tiny parser — no eval, no risk.
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
  row: F20Row,
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
