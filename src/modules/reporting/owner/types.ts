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

/**
 * One slice of the expense (class 6) or revenue (class 7) breakdown.
 * Aggregated by 2-digit account base; `label` is the patron-facing Romanian
 * phrase ("Salarii si contributii", "Vanzari produse"). `percent` is share of
 * total expenses or revenues that month (0..100).
 */
export interface CategoryBreakdownItem {
  code: string;
  label: string;
  value: number;
  percent: number;
}

/**
 * One row in "Top cheltuieli ale lunii": a single leaf 6x account with its
 * monthly rulajD. Used for the patron to see specifically what cost most.
 */
export interface TopMonthlyExpense {
  cont: string;
  denumire: string;
  value: number;
  /** Share of total monthly expenses (0..100). */
  percent: number;
}

/**
 * Burn rate analysis: how long can the firm operate at the current expense
 * pace given the cash on hand? Used by the "Runway" card.
 *
 * `monthlyBurnRate` = average monthly expenses across the trailing window.
 * `monthsRemaining` = cash / burn (Infinity if burn==0).
 * `status` is a coarse classification for UI tone.
 */
export interface RunwayProjection {
  cashAvailable: number;
  monthlyBurnRate: number;
  monthsRemaining: number;
  windowMonths: number;
  status: "comfortable" | "tight" | "critical" | "unknown";
}

/**
 * "Mai poate firma sa plateasca salariile luna asta?"
 *  monthsCovered = cash / monthlyPayroll.
 */
export interface SalaryAffordability {
  monthlyPayroll: number;
  cashAvailable: number;
  monthsCovered: number;
  status: "comfortable" | "tight" | "critical" | "no_payroll";
}

/**
 * One row in the per-vertical breakdown — what each business line contributed
 * to the month, derived by applying allocation splits to each cont's rulaj.
 *
 * `revenue`, `expenses`, `profit` are all positive numbers (expenses positive
 * for readability; profit is revenue - expenses and may be negative).
 */
export interface VerticalBreakdownItem {
  verticalId: string;
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
  /** Share of total monthly expenses attributable to this vertical (0..100). */
  expenseSharePct: number;
}

/**
 * Same metric for this month vs the same month one year ago. `delta` is the
 * absolute change, `deltaPct` the percentage change (null when previous year
 * was zero or missing).
 */
export interface YearOverYearComparison {
  revenue: { current: number; previous: number; delta: number; deltaPct: number | null };
  expenses: { current: number; previous: number; delta: number; deltaPct: number | null };
  profit: { current: number; previous: number; delta: number; deltaPct: number | null };
  cashEnd: { current: number; previous: number; delta: number; deltaPct: number | null };
  hasPreviousYear: boolean;
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
  /** Patron-facing breakdown of monthly expenses by 2-digit account class. */
  expenseBreakdown: CategoryBreakdownItem[];
  /** Patron-facing breakdown of monthly revenues by 2-digit account class. */
  revenueBreakdown: CategoryBreakdownItem[];
  /** Top 10 individual expense accounts that drove the month. */
  topMonthlyExpenses: TopMonthlyExpense[];
  /** Cash runway projection at current burn rate. */
  runway: RunwayProjection;
  /** Can the firm cover its payroll? */
  salaryAffordability: SalaryAffordability;
  /** This month vs same month last year. */
  yoy: YearOverYearComparison;
  /** Per-vertical decomposition of the month (PR-2c). Empty array when the
   *  client doesn't have verticalsEnabled or has no allocations yet. */
  verticalBreakdown: VerticalBreakdownItem[];
}
