import type { BalanceRowView } from "@/modules/balances";
import { loadCatalogSync } from "@/modules/accounts";
import type { CatalogAccount, CppGroup, TaxRegime } from "@/modules/accounts";
import type { CppData, CppLine } from "./types";

/**
 * D13: map a tax regime to the primary account(s) that carry the tax charge.
 * Other profit-tax accounts are ignored for the given regime (but still
 * excluded from cheltuieli exploatare by isProfitTax=true).
 *
 * The arrays allow multiple accounts to contribute (e.g. some micro firms
 * split between 698 and 697 during transition periods).
 */
const TAX_REGIME_ACCOUNTS: Record<TaxRegime, string[]> = {
  profit_standard: ["691"],
  profit_micro_1: ["698"],
  profit_micro_3: ["698"],
  profit_specific: ["695"],
  imca: ["697"],
  deferred: ["698"],
};

interface GroupedAccount {
  code: string;
  label: string;
  value: number;
}

const SECTION_HEADERS: Record<CppGroup, string> = {
  VENITURI_EXPLOATARE: "VENITURI DIN EXPLOATARE",
  CHELTUIELI_EXPLOATARE: "CHELTUIELI DIN EXPLOATARE",
  VENITURI_FINANCIARE: "VENITURI FINANCIARE",
  CHELTUIELI_FINANCIARE: "CHELTUIELI FINANCIARE",
};

const DEBIT_SIDE_GROUPS = new Set<CppGroup>(["CHELTUIELI_EXPLOATARE", "CHELTUIELI_FINANCIARE"]);

export interface CppOptions {
  /** D13: which accounts map to the impozit line. Defaults to all profit-tax accounts. */
  taxRegime?: TaxRegime;
}

export function computeCpp(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>,
  options: CppOptions = {}
): CppData {
  const cat = catalog ?? loadCatalogSync();
  const leafRows = rows.filter((r) => r.isLeaf);
  const lines: CppLine[] = [];

  const grouped = groupByCppSection(leafRows, cat);

  const venExpl = buildSection(grouped.VENITURI_EXPLOATARE, lines, "VENITURI_EXPLOATARE");
  const chelExpl = buildSection(grouped.CHELTUIELI_EXPLOATARE, lines, "CHELTUIELI_EXPLOATARE");
  const rezultatExploatare = round2(venExpl - chelExpl);
  lines.push(totalLine("REZULTAT DIN EXPLOATARE", rezultatExploatare));

  const venFin = buildSection(grouped.VENITURI_FINANCIARE, lines, "VENITURI_FINANCIARE");
  const chelFin = buildSection(grouped.CHELTUIELI_FINANCIARE, lines, "CHELTUIELI_FINANCIARE");
  const rezultatFinanciar = round2(venFin - chelFin);
  lines.push(totalLine("REZULTAT FINANCIAR", rezultatFinanciar));

  const rezultatBrut = round2(rezultatExploatare + rezultatFinanciar);
  lines.push(totalLine("REZULTAT BRUT", rezultatBrut));

  const taxResult = sumProfitTax(leafRows, cat, options.taxRegime);
  if (taxResult.total > 0) {
    lines.push({
      cont: taxResult.displayCode,
      denumire: taxResult.displayLabel,
      indent: 0,
      isHeader: false,
      isTotal: false,
      value: taxResult.total,
    });
  }

  const rezultatNet = round2(rezultatBrut - taxResult.total);
  lines.push(totalLine("REZULTAT NET", rezultatNet));

  return {
    lines,
    venituriExploatare: round2(venExpl),
    cheltuieliExploatare: round2(chelExpl),
    rezultatExploatare,
    venituriFinanciare: round2(venFin),
    cheltuieliFinanciare: round2(chelFin),
    rezultatFinanciar,
    rezultatBrut,
    rezultatNet,
  };
}

function groupByCppSection(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>
): Record<CppGroup, Map<string, GroupedAccount>> {
  const buckets: Record<CppGroup, Map<string, GroupedAccount>> = {
    VENITURI_EXPLOATARE: new Map(),
    CHELTUIELI_EXPLOATARE: new Map(),
    VENITURI_FINANCIARE: new Map(),
    CHELTUIELI_FINANCIARE: new Map(),
  };

  for (const row of rows) {
    if (row.contBase === "121") continue;
    const meta = resolveCatalogForRow(row, catalog);
    if (!meta || !meta.cppGroup) continue;
    if (meta.special === "profit_tax" || meta.special === "micro_tax") continue;

    const side = DEBIT_SIDE_GROUPS.has(meta.cppGroup) ? row.rulajTD : row.rulajTC;
    if (side === 0) continue;

    const bucket = buckets[meta.cppGroup];
    const key = meta.code;
    const existing = bucket.get(key);
    const label = meta.cppLabel ?? meta.name;

    if (existing) {
      existing.value += side;
    } else {
      bucket.set(key, { code: key, label, value: side });
    }
  }

  return buckets;
}

function resolveCatalogForRow(
  row: BalanceRowView,
  catalog: Map<string, CatalogAccount>
): CatalogAccount | null {
  const direct = catalog.get(row.contBase);
  if (direct) return direct;

  for (let len = row.contBase.length - 1; len >= 2; len--) {
    const prefix = row.contBase.slice(0, len);
    const match = catalog.get(prefix);
    if (match && match.cppGroup) return match;
  }
  return null;
}

function buildSection(
  bucket: Map<string, GroupedAccount>,
  lines: CppLine[],
  group: CppGroup
): number {
  lines.push({
    cont: "",
    denumire: SECTION_HEADERS[group],
    indent: 0,
    isHeader: true,
    isTotal: false,
    value: 0,
  });

  let total = 0;
  const sorted = [...bucket.values()].sort((a, b) => a.code.localeCompare(b.code));

  for (const item of sorted) {
    lines.push({
      cont: item.code,
      denumire: item.label,
      indent: 1,
      isHeader: false,
      isTotal: false,
      value: round2(item.value),
    });
    total += item.value;
  }

  lines.push(totalLine(`Total ${SECTION_HEADERS[group].toLowerCase()}`, round2(total)));
  return total;
}

interface TaxSum {
  total: number;
  displayCode: string;
  displayLabel: string;
}

/**
 * D13: sum the profit-tax charge for a given tax regime.
 *
 * When `regime` is provided, only the accounts mapped to that regime
 * contribute. When omitted (legacy behavior), any account with isProfitTax
 * contributes — used for backward compatibility until every Client row has
 * an explicit taxRegime set.
 */
function sumProfitTax(
  rows: BalanceRowView[],
  catalog: Map<string, CatalogAccount>,
  regime?: TaxRegime
): TaxSum {
  const allowedCodes = regime ? new Set(TAX_REGIME_ACCOUNTS[regime]) : null;
  let total = 0;
  const contributingCodes: string[] = [];

  for (const row of rows) {
    const meta = catalog.get(row.contBase);
    if (!meta?.isProfitTax) continue;
    if (allowedCodes && !allowedCodes.has(row.contBase)) continue;

    const value = row.rulajTD - row.rulajTC; // rulajTC nets out any reversal
    if (value <= 0) continue;

    total += value;
    contributingCodes.push(row.contBase);
  }

  const displayCode = contributingCodes[0] ?? (regime ? TAX_REGIME_ACCOUNTS[regime][0] : "691");
  const displayLabel = getTaxLabel(displayCode);

  return { total: round2(total), displayCode, displayLabel };
}

function getTaxLabel(code: string): string {
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
      return "Impozit";
  }
}

function totalLine(label: string, value: number): CppLine {
  return { cont: "", denumire: label, indent: 0, isHeader: false, isTotal: true, value };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
