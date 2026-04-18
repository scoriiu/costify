export interface KpiSnapshot {
  cashBank: number;
  clientiCreante: number;
  furnizoriDatorii: number;
  tvaDePlata: number;
  rezultat: number;
  totalVenituri: number;
  totalCheltuieli: number;
  marjaOperationala: number | null;
}

export interface CppLine {
  cont: string;
  denumire: string;
  indent: number;
  isHeader: boolean;
  isTotal: boolean;
  value: number;
}

export interface CppData {
  lines: CppLine[];
  venituriExploatare: number;
  cheltuieliExploatare: number;
  rezultatExploatare: number;
  venituriFinanciare: number;
  cheltuieliFinanciare: number;
  rezultatFinanciar: number;
  rezultatBrut: number;
  rezultatNet: number;
}

/** D17: one row of the detailed F20 view (OMFP 1802 Anexa 3). */
export interface CppF20Line {
  rowNumber: string;
  label: string;
  section: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  indent: number;
  kind: "detail" | "subtotal" | "total";
  value: number;
  /** Accounts that contributed to this detail row. Empty for subtotals/totals. */
  accounts?: string[];
  /** Human description of how a subtotal/total is computed. */
  formula?: string;
}

export interface CppF20Data {
  version: string;
  lines: CppF20Line[];
  /** Convenience alias for the final rezultat net. */
  rezultatNet: number;
  rezultatBrut: number;
  venituriTotale: number;
  cheltuieliTotale: number;
  venituriExploatare: number;
  cheltuieliExploatare: number;
  rezultatExploatare: number;
  venituriFinanciare: number;
  cheltuieliFinanciare: number;
  rezultatFinanciar: number;
}

export interface BalanceSheetSection {
  label: string;
  code: string;
  value: number;
  children: BalanceSheetRow[];
}

export interface BalanceSheetRow {
  cont: string;
  denumire: string;
  value: number;
}

export interface BalanceSheetData {
  activ: BalanceSheetSection[];
  pasiv: BalanceSheetSection[];
  totalActiv: number;
  totalPasiv: number;
  isBalanced: boolean;
}
