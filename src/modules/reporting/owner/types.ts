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

import type { IndustryKpiSection } from "@/modules/reporting/industry";

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
  /** Depth in the category tree. 0 = root, 1 = first sub-category, etc.
   *  Used by the UI to indent visually. Items from the OMFP fallback path
   *  always have depth 0. */
  depth?: number;
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

/**
 * §8 — Cash flow split into Operating / Investing / Financing.
 * Derived from class-range rules over the month's rulaj:
 *   - Operating  = changes in 5xx (cash/bank) NOT explained by I or F
 *   - Investing  = movements through 21x/26x/27x (imobilizari) net of disposals
 *   - Financing  = movements through 16x (credite), 162 (leasing), 401x leasing,
 *                  457 (dividende plătite), 1012/1041 (aporturi)
 *
 * Approximation note: without explicit Operating/Investing/Financing tagging
 * per movement we attribute via the *other* leg of cash-touching journal
 * lines. This is honest at the aggregate-month level for the dashboard.
 */
export interface CashflowBreakdown {
  /** Cash at the start of the month. */
  cashStart: number;
  /** Cash at the end of the month. */
  cashEnd: number;
  /** Net change = cashEnd − cashStart. */
  netChange: number;
  /** Operating = day-to-day business (cash in from clients minus cash out
   *  to suppliers / state / employees). */
  operating: number;
  /** Investing = buying/selling assets. Negative when buying. */
  investing: number;
  /** Financing = loans drawn/repaid, dividends paid, capital changes. */
  financing: number;
  /** Detailed breakdown of operating: top inflows/outflows. */
  operatingDetail: Array<{ label: string; value: number; kind: "in" | "out" }>;
  /** Detailed breakdown of investing. */
  investingDetail: Array<{ label: string; value: number; kind: "in" | "out" }>;
  /** Detailed breakdown of financing. */
  financingDetail: Array<{ label: string; value: number; kind: "in" | "out" }>;
}

/**
 * §12 — Patrimoniu (balance sheet) snapshot.
 * Single-row per ROOT bucket; sub-buckets expandable client-side.
 *
 * Activ buckets:
 *   - imobilizari    (class 2: 21x, 23x, 26x, 27x, 28x as contra)
 *   - stocuri        (class 3: 30x-39x)
 *   - creante        (class 411, 4111, 4118, 413, 418, 461, etc.)
 *   - cashAndEq      (class 5: 5121, 5311, 5328, casa)
 *   - cheltuieliInAvans (471)
 *
 * Pasiv buckets:
 *   - capitalSocial  (101x)
 *   - rezerveProfit  (106x, 117x, 121, 129)
 *   - datoriiLT      (162, 1622, 167, etc.)
 *   - datoriiCT      (401, 421, 423, 431, 437, 441, 442, 444, etc.)
 *   - venituriInAvans (472)
 */
export interface PatrimoniuBucket {
  id: string;
  label: string;
  description: string;
  value: number;
  items: Array<{ code: string; label: string; value: number }>;
}

export interface Patrimoniu {
  /** Reference period. */
  asOfYear: number;
  asOfMonth: number;
  activ: PatrimoniuBucket[];
  pasiv: PatrimoniuBucket[];
  totalActiv: number;
  totalPasiv: number;
  /** Difference between Activ and Pasiv — should be ~0 in a clean balance.
   *  Non-zero values flag a data-quality issue the contabil must resolve. */
  difference: number;
  /** True when |difference| < 1 RON. */
  isBalanced: boolean;
}

/**
 * §6 — Verdict narativ: a single-paragraph summary the entrepreneur reads first.
 * Built deterministically from the snapshot. `tone` drives the banner color.
 * `subline` is the 4-6 word one-liner ("Lichiditate sub prag", "Profit in crestere").
 */
export interface Verdict {
  tone: "positive" | "neutral" | "warning" | "negative";
  /** 1-line headline: "Firma e pe plus si stai bine cu cash-ul". */
  headline: string;
  /** 2-3 sentence paragraph with the supporting numbers. */
  body: string;
  /** Up to 3 short tags: "Profit +18%", "Cash 4.2 luni", "TVA scadent". */
  highlights: string[];
}

/**
 * §6 — KPI strip: 4-6 power KPIs surfaced near the top.
 * Every KPI is derived from existing data; `state` carries the signal.
 */
export interface KpiStripItem {
  id: string;
  label: string;
  value: string;
  /** Hint about what this means in plain Romanian. */
  hint: string;
  state: "good" | "neutral" | "warn" | "danger";
  /** Optional delta vs prev period — "+ 12 zile fata de luna trecuta". */
  delta?: string;
}

/**
 * §10 — Composite health score (0-100) with sub-scores.
 * Each sub-score is one of the 4 critical KPIs from the spec:
 *   - liquidity:    cash / monthly burn (>=6 -> 100)
 *   - profitability: monthly profit margin (>15% -> 100, <0 -> 0)
 *   - efficiency:    receivables-to-revenue (lower = better, proxy for DSO)
 *   - solvency:     equity / total assets (proxy for leverage)
 *
 * `tier` collapses overall to a 4-tier band used by the badge UI.
 */
export interface HealthSubscore {
  id: "liquidity" | "profitability" | "efficiency" | "solvency";
  label: string;
  /** 0-100. */
  score: number;
  /** Plain Romanian explanation of the current state. */
  message: string;
  state: "good" | "neutral" | "warn" | "danger";
}

export interface HealthScore {
  /** 0-100 composite, weighted average of subscores. */
  score: number;
  tier: "excellent" | "good" | "watch" | "alert";
  tierLabel: string;
  /** 1-line description of overall state. */
  message: string;
  subscores: HealthSubscore[];
}

/**
 * §10 — Catalog of accounting ratios at L2. Each ratio carries its current
 * value, the band it sits in, and a plain Romanian interpretation.
 * Bands are advisory only — they are not legal thresholds.
 */
export interface FinancialRatio {
  id: string;
  /** Romanian patron-facing label. */
  label: string;
  /** Technical formula label for the curious. */
  formula: string;
  /** Group: "lichiditate" | "profitabilitate" | "solvabilitate" | "eficienta". */
  group: "lichiditate" | "profitabilitate" | "solvabilitate" | "eficienta";
  /** Current value. `null` when not computable (missing data, divide-by-zero). */
  value: number | null;
  /** Display format hint. */
  format: "ratio" | "percent" | "days" | "lei";
  /** Optional target band ("> 1.5", "10-20%"). */
  target?: string;
  /** Tone of current value. */
  state: "good" | "neutral" | "warn" | "danger" | "unknown";
  /** Plain Romanian explanation of what this means. */
  interpretation: string;
  /** Substituted calculation with the actual numbers, so the value is never
   *  a black box: "120.000 / 80.000 = 1,50". Optional: snapshots frozen
   *  before this field exist without it. */
  calculation?: string | null;
}

/**
 * §11 — Calendar de obligatii: upcoming things that must be paid.
 * Deterministic from data (TVA scadent, salarii recurring, contributii).
 */
export interface ObligationEntry {
  id: string;
  /** Human label: "TVA luna trecuta", "Salarii angajati". */
  label: string;
  /** ISO date (YYYY-MM-DD) when this is due. */
  dueDate: string;
  /** Amount in RON. May be 0 if not yet known. */
  amount: number;
  /** Plain Romanian one-liner. */
  hint: string;
  /** "tax" | "salary" | "contrib" | "loan" — drives icon/tone. */
  kind: "tax" | "salary" | "contrib" | "loan" | "other";
  /** Days until due. Negative if past due. */
  daysUntil: number;
}

/**
 * §9 — Top customer / supplier by ACTIVITY (cash in / cash out) for the month.
 * Computed from rulajC of 411-analytic (incasari) and rulajD of 401-analytic
 * (plati).
 */
export interface TopActivityPartner {
  cont: string;
  partnerName: string;
  /** Amount of cash movement this month. */
  amount: number;
  /** Share of total monthly customer-incasari (or supplier-plati). */
  percent: number;
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
  /** §6 — Single-paragraph narrative the patron reads first. */
  verdict: Verdict;
  /** §6 — Up to 6 power-KPIs surfaced near the top of the page. */
  kpiStrip: KpiStripItem[];
  /** §8 — Cash flow decomposed into Operating / Investing / Financing. */
  cashflowBreakdown: CashflowBreakdown;
  /** §11 — Upcoming things to pay (TVA, salarii, contributii). */
  obligations: ObligationEntry[];
  /** §10 — Composite health score 0-100 with 4 sub-scores. */
  healthScore: HealthScore;
  /** §10 — Catalog of financial ratios for the L2 view. */
  ratios: FinancialRatio[];
  /** §12 — Activ vs Pasiv snapshot for the Patrimoniu page. */
  patrimoniu: Patrimoniu;
  /** §9 — Top customers by cash incasata this month. */
  topCustomersByActivity: TopActivityPartner[];
  /** §9 — Top suppliers by cash platita this month. */
  topSuppliersByActivity: TopActivityPartner[];
  /** Sprint 7: a small trust signal for the antreprenor showing that the
   *  numbers they're looking at come from data the contabil has reviewed,
   *  not raw unreviewed bank statements. Drives the small badge in the
   *  /firma header. Hidden when nothing has been mapped at all (the
   *  trust signal would be a lie). */
  /** Industry-aware KPI catalog (essentials + industry-specific group),
   *  with full formula traces for debugging. Optional because published
   *  snapshots frozen before this feature don't carry it. */
  industryKpis?: IndustryKpiSection;
  dataQuality: {
    /** Percent of class 6+7 rulaj that's covered by an explicit category
     *  mapping or a partner override (same definition as CoverageStats.
     *  percent in the Mapari Cashflow loader). */
    coveragePercent: number;
    /** Total count of partner-level overrides the contabil has created
     *  across all conts. Higher = more granular review. */
    partnerOverrideCount: number;
    /** True when there's at least one cont-mapping or one partner override.
     *  When false the trust badge is hidden — claiming 'reviewed' on a
     *  firm where nothing has been reviewed would be dishonest. */
    hasAnyReview: boolean;
  };
}
