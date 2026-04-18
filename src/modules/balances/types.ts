export interface BalanceFilter {
  datasetId: string;
  year?: number;
  month?: number;
  leafOnly?: boolean;
  contBasePrefix?: string;
}

export interface BalanceSummary {
  totalFinD: number;
  totalFinC: number;
  totalRulajD: number;
  totalRulajC: number;
  accountCount: number;
  isBalanced: boolean;
}

export interface BalanceRowView {
  cont: string;
  contBase: string;
  denumire: string;
  tip: string;
  unmapped: boolean;
  /**
   * D11: true when the account is in class 8 or 9 (memorandum / extra-bilantier).
   * These rows are VISIBLE in Balanta de Verificare but must be excluded from
   * Bilant, CPP, KPIs, and any balance totals. The UI should display a flag.
   */
  isExtraBilantier: boolean;
  isLeaf: boolean;
  hasChild: boolean;
  debInit: number;
  credInit: number;
  soldInD: number;
  soldInC: number;
  debPrec: number;
  credPrec: number;
  rulajD: number;
  rulajC: number;
  rulajTD: number;
  rulajTC: number;
  totalDeb: number;
  totalCred: number;
  finD: number;
  finC: number;
}

export interface DatasetPeriod {
  year: number;
  month: number;
}
