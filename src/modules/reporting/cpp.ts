import type { BalanceRowView } from "@/modules/balances";
import type { CppData, CppLine } from "./types";

interface AccountGroup {
  prefix: string;
  label: string;
}

const VENITURI_EXPLOATARE: AccountGroup[] = [
  { prefix: "701", label: "Vanzari de produse finite" },
  { prefix: "704", label: "Venituri din servicii prestate" },
  { prefix: "706", label: "Venituri din chirii" },
  { prefix: "707", label: "Venituri din vanzarea marfurilor" },
  { prefix: "708", label: "Venituri din activitati diverse" },
  { prefix: "711", label: "Variatia stocurilor" },
  { prefix: "741", label: "Venituri din subventii" },
  { prefix: "758", label: "Alte venituri din exploatare" },
];

const CHELTUIELI_EXPLOATARE: AccountGroup[] = [
  { prefix: "601", label: "Cheltuieli materii prime" },
  { prefix: "602", label: "Cheltuieli materiale consumabile" },
  { prefix: "604", label: "Cheltuieli materiale nestocate" },
  { prefix: "605", label: "Cheltuieli cu energia si apa" },
  { prefix: "607", label: "Cheltuieli cu marfurile" },
  { prefix: "611", label: "Cheltuieli intretinere si reparatii" },
  { prefix: "612", label: "Cheltuieli cu chiriile" },
  { prefix: "613", label: "Cheltuieli cu asigurarile" },
  { prefix: "621", label: "Cheltuieli cu colaboratorii" },
  { prefix: "622", label: "Cheltuieli comisioane si onorarii" },
  { prefix: "623", label: "Cheltuieli protocol si reclama" },
  { prefix: "624", label: "Cheltuieli cu transportul" },
  { prefix: "625", label: "Cheltuieli cu deplasari" },
  { prefix: "626", label: "Cheltuieli postale si telecom" },
  { prefix: "627", label: "Cheltuieli servicii bancare" },
  { prefix: "628", label: "Alte cheltuieli cu servicii" },
  { prefix: "635", label: "Cheltuieli impozite si taxe" },
  { prefix: "641", label: "Cheltuieli cu salariile" },
  { prefix: "645", label: "Cheltuieli asigurari sociale" },
  { prefix: "646", label: "Cheltuieli tichete de masa" },
  { prefix: "654", label: "Pierderi din creante" },
  { prefix: "658", label: "Alte cheltuieli de exploatare" },
  { prefix: "6811", label: "Cheltuieli cu amortizarea" },
  { prefix: "6812", label: "Cheltuieli cu provizioanele" },
];

const VENITURI_FINANCIARE: AccountGroup[] = [
  { prefix: "765", label: "Venituri diferente curs valutar" },
  { prefix: "766", label: "Venituri din dobanzi" },
  { prefix: "768", label: "Alte venituri financiare" },
];

const CHELTUIELI_FINANCIARE: AccountGroup[] = [
  { prefix: "665", label: "Cheltuieli diferente curs valutar" },
  { prefix: "666", label: "Cheltuieli cu dobanzile" },
  { prefix: "668", label: "Alte cheltuieli financiare" },
];

export function computeCpp(rows: BalanceRowView[]): CppData {
  const leafRows = rows.filter((r) => r.isLeaf);
  const lines: CppLine[] = [];

  const venExpl = buildSection(leafRows, VENITURI_EXPLOATARE, "credit", lines, "VENITURI DIN EXPLOATARE", 0);
  const chelExpl = buildSection(leafRows, CHELTUIELI_EXPLOATARE, "debit", lines, "CHELTUIELI DIN EXPLOATARE", 0);
  const rezultatExploatare = round2(venExpl - chelExpl);

  lines.push(totalLine("REZULTAT DIN EXPLOATARE", rezultatExploatare));

  const venFin = buildSection(leafRows, VENITURI_FINANCIARE, "credit", lines, "VENITURI FINANCIARE", 0);
  const chelFin = buildSection(leafRows, CHELTUIELI_FINANCIARE, "debit", lines, "CHELTUIELI FINANCIARE", 0);
  const rezultatFinanciar = round2(venFin - chelFin);

  lines.push(totalLine("REZULTAT FINANCIAR", rezultatFinanciar));

  const rezultatBrut = round2(rezultatExploatare + rezultatFinanciar);
  lines.push(totalLine("REZULTAT BRUT", rezultatBrut));

  const impozitProfit = sumByPrefix(leafRows, "691", "debit");
  if (impozitProfit > 0) {
    lines.push({ cont: "691", denumire: "Impozit pe profit", indent: 0, isHeader: false, isTotal: false, value: impozitProfit });
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

function buildSection(
  rows: BalanceRowView[],
  groups: AccountGroup[],
  side: "debit" | "credit",
  lines: CppLine[],
  headerLabel: string,
  indent: number
): number {
  lines.push({ cont: "", denumire: headerLabel, indent, isHeader: true, isTotal: false, value: 0 });

  let sectionTotal = 0;
  for (const group of groups) {
    const value = sumByPrefix(rows, group.prefix, side);
    if (value === 0) continue;

    lines.push({
      cont: group.prefix,
      denumire: group.label,
      indent: indent + 1,
      isHeader: false,
      isTotal: false,
      value: round2(value),
    });
    sectionTotal += value;
  }

  lines.push(totalLine(`Total ${headerLabel.toLowerCase()}`, round2(sectionTotal)));
  return sectionTotal;
}

function sumByPrefix(rows: BalanceRowView[], prefix: string, side: "debit" | "credit"): number {
  let total = 0;
  for (const r of rows) {
    if (!r.contBase.startsWith(prefix)) continue;
    if (r.contBase.startsWith("121")) continue;
    total += side === "debit" ? r.rulajTD : r.rulajTC;
  }
  return total;
}

function totalLine(label: string, value: number): CppLine {
  return { cont: "", denumire: label, indent: 0, isHeader: false, isTotal: true, value };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
