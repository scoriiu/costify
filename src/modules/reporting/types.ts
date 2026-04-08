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
