export interface JournalEntry {
  data: Date;
  year: number;
  month: number;
  ndp: string;
  contD: string;
  contDBase: string;
  contC: string;
  contCBase: string;
  suma: number;
  explicatie: string;
  felD: string;
  categorie: string | null;
  cod: string | null;
  validat: string | null;
  tva: number | null;
}

export interface ParseError {
  row: number;
  field?: string;
  message: string;
}

export interface JournalParseResult {
  entries: JournalEntry[];
  years: number[];
  errors: ParseError[];
  totalRaw: number;
  accountNames: Map<string, string>;
}

export interface BalanceRowData {
  cont: string;
  denumire: string;
  tip: string;
  unmapped: boolean;
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
