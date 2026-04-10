import type { BalanceRowView } from "@/modules/balances";
import { loadCatalogSync } from "@/modules/accounts";
import type { CatalogAccount, CppGroup } from "@/modules/accounts";
import type { CppData, CppLine } from "./types";

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

export function computeCpp(
  rows: BalanceRowView[],
  catalog?: Map<string, CatalogAccount>
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

  const impozitProfit = sumProfitTax(leafRows, cat);
  if (impozitProfit > 0) {
    lines.push({
      cont: "691",
      denumire: "Impozit pe profit",
      indent: 0,
      isHeader: false,
      isTotal: false,
      value: impozitProfit,
    });
  }

  const rezultatNet = round2(rezultatBrut - impozitProfit);
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

function sumProfitTax(rows: BalanceRowView[], catalog: Map<string, CatalogAccount>): number {
  let total = 0;
  for (const row of rows) {
    const meta = catalog.get(row.contBase);
    if (!meta) continue;
    if (meta.special !== "profit_tax" && meta.special !== "micro_tax") continue;
    total += row.rulajTD;
  }
  return round2(total);
}

function totalLine(label: string, value: number): CppLine {
  return { cont: "", denumire: label, indent: 0, isHeader: false, isTotal: true, value };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
