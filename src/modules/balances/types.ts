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
