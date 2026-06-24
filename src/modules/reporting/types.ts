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

/** One business-line (vertical) column shown in the per-line CPP breakdown. */
export interface CppVerticalColumn {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface CppLine {
  cont: string;
  denumire: string;
  indent: number;
  isHeader: boolean;
  isTotal: boolean;
  value: number;
  /** Per business-line split of `value`, keyed by vertical id. Present only
   *  when the client has business lines enabled. Always sums to `value`
   *  exactly (the breakdown never leaks money). Absent on header rows. */
  byVertical?: Record<string, number>;
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
  /** Business-line columns in display order. Present only when verticals are
   *  enabled and at least one line carries a `byVertical` breakdown. */
  verticals?: CppVerticalColumn[];
}

/** D17: one row of the detailed F20 view (OMFP 1802 Anexa 3). */
export interface CppF20Line {
  rowNumber: string;
  label: string;
  section: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  indent: number;
  kind: "detail" | "info" | "subtotal" | "total";
  value: number;
  /** Accounts that contributed to this detail row. Empty for subtotals/totals. */
  accounts?: string[];
  /** Human description of how a subtotal/total is computed. */
  formula?: string;
  /** Per business-line split of `value`, keyed by vertical id. Present only
   *  when verticals are enabled. Sums to `value` exactly. */
  byVertical?: Record<string, number>;
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
  /** Business-line columns in display order. Present only when verticals are
   *  enabled and at least one line carries a `byVertical` breakdown. */
  verticals?: CppVerticalColumn[];
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
