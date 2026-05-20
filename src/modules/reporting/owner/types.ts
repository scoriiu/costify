/**
 * Types for the owner-view computations.
 *
 * These are surfaces the entrepreneur sees, derived purely from the journal:
 *   - FinancialSummary  → cards "Bani / De primit / De platit / Profit"
 *   - CashPosition      → answers "pot sa-mi platesc obligatiile?"
 *   - OwnerWithdrawals  → answers "cat am scos eu din firma?"
 *   - MonthlyTrendPoint → answers "cum am evoluat?"
 *   - Insight           → answers "ce ar trebui sa stii?"
 *   - OutstandingPartner → answers "cine imi datoreaza / cui ii datorez?"
 */

export interface FinancialSummary {
  cifraAfaceriTotal: number;
  cifraAfaceriLuna: number;
  cheltuieliTotal: number;
  cheltuieliLuna: number;
  venituriLuna: number;
  soldRegistruCasa: number;
  soldConturiBancare: number;
  creditareSocietate: number;
  clientiNeincasati: number;
  furnizoriNeachitati: number;
}

export interface CashPositionItem {
  id: string;
  label: string;
  value: number;
}

export interface CashPosition {
  disponibil: CashPositionItem[];
  obligatii: CashPositionItem[];
  totalDisponibil: number;
  totalObligatii: number;
  net: number;
}

export interface OwnerWithdrawalsItem {
  id: string;
  label: string;
  description: string;
  value: number;
}

export interface OwnerWithdrawals {
  items: OwnerWithdrawalsItem[];
  total: number;
}

export interface MonthlyTrendPoint {
  year: number;
  month: number;
  monthLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  cashEnd: number;
  receivables: number;
  payables: number;
}

export interface Insight {
  type: "info" | "warning" | "positive" | "negative";
  category: "profitabilitate" | "cash_flow" | "datorii" | "operatiuni";
  title: string;
  message: string;
  action?: string;
}

export interface OutstandingPartner {
  cont: string;
  partnerName: string;
  sold: number;
}

export interface OwnerSnapshot {
  meta: {
    clientId: string;
    name: string;
    cui: string | null;
    slug: string;
    year: number;
    month: number;
    periodLabel: string;
  };
  summary: FinancialSummary;
  cashPosition: CashPosition;
  ownerWithdrawals: OwnerWithdrawals;
  trends: MonthlyTrendPoint[];
  insights: Insight[];
  outstanding: {
    clienti: OutstandingPartner[];
    furnizori: OutstandingPartner[];
  };
}
