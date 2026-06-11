export type IndustryId =
  | "consultanta"
  | "retail"
  | "telecom"
  | "banking"
  | "servicii_contabile"
  | "inchirieri"
  | "general";

export type IndustryResolution = "auto" | "manual" | "journal" | "default";

/**
 * Hint derived from comparing the resolved industry with the activity
 * visible in the registru jurnal (revenue account mix).
 *  - "fallback": no CAEN and no manual pick; the journal chose the profile.
 *  - "mismatch": the journal contradicts the configured industry.
 */
export interface JournalIndustryHint {
  kind: "fallback" | "mismatch";
  /** Activity seen in the journal: comert, servicii, productie, inchirieri,
   *  activitate financiara. */
  activity: string;
  /** Full message for the accountant, with the revenue-mix evidence. */
  message: string;
}

export interface IndustryOption {
  id: IndustryId;
  label: string;
  description: string;
}

export type KpiGroupId =
  | "profitabilitate"
  | "lichiditate"
  | "eficienta"
  | "indatorare"
  | "crestere"
  | "industrie";

export type KpiState = "good" | "neutral" | "warn" | "danger" | "unknown";

export type KpiFormat = "percent" | "days" | "ratio" | "lei";

/**
 * One resolved input that entered a KPI formula. The `source` describes
 * exactly which balance-sheet aggregation produced the value (account
 * prefixes + side), so the contabil can reproduce the number from the
 * Balanta de Verificare by hand.
 */
export interface KpiInputValue {
  id: string;
  /** Short name used inside the formula: "Creante clienti". */
  label: string;
  /** Audit trail: "Sold final debitor conturi 411 (cu 413, 418, minus 419)". */
  source: string;
  value: number;
}

export interface KpiThreshold {
  /** Value at/beyond which the KPI is "good". */
  target: number;
  /** Value at/beyond which the KPI is "danger". */
  alarm: number;
  /** "higher" = bigger is better (marja). "lower" = smaller is better (DSO). */
  direction: "higher" | "lower";
  /** Display string: "> 30%", "< 45 zile", "30-60 zile". */
  label: string;
}

export interface IndustryKpi {
  id: string;
  group: KpiGroupId;
  labelContabil: string;
  labelAntreprenor: string;
  /** OMFP vocabulary: "Sold 411 / (Rulaj creditor 70x / 365)". */
  formulaContabil: string;
  /** Plain Romanian: "Banii de incasat impartiti la vanzarile unei zile". */
  formulaAntreprenor: string;
  /** Resolved inputs that produced the value. Empty when unavailable. */
  inputs: KpiInputValue[];
  /** Human-readable substitution: "45.230 / (532.000 / 365) = 31 zile". */
  calculation: string | null;
  value: number | null;
  format: KpiFormat;
  thresholds: KpiThreshold | null;
  state: KpiState;
  interpretationContabil: string;
  interpretationAntreprenor: string;
  /** Set when the KPI cannot be computed from the journal (needs
   *  operational inputs like headcount or subscriber counts). */
  unavailableReason: string | null;
}

export interface IndustryKpiGroup {
  id: KpiGroupId;
  label: string;
  /** Info explainer for the contabil: what the group measures and from
   *  which accounts it is derived. */
  descriptionContabil: string;
  /** Info explainer for the antreprenor: zero jargon. */
  descriptionAntreprenor: string;
  kpis: IndustryKpi[];
}

export interface IndustryKpiSection {
  industry: IndustryId;
  industryLabel: string;
  industrySource: IndustryResolution;
  caen: string | null;
  /** Period the values describe (cumulative Jan -> month). */
  year: number;
  month: number;
  /** Set when the journal either chose the profile (no CAEN/manual) or
   *  contradicts the configured one. Accountant-facing only. */
  journalHint: JournalIndustryHint | null;
  groups: IndustryKpiGroup[];
}

/**
 * Raw aggregates extracted once from BalanceRowView[] and shared by every
 * KPI formula. All YTD values are cumulative Jan -> selected month.
 * Each value carries its own audit-trail description (see inputs.ts).
 */
export interface KpiBaseInputs {
  monthsElapsed: number;
  cifraAfaceri: number;
  venituriTotale: number;
  cheltuieliTotale: number;
  cogs: number;
  amortizare: number;
  cheltuieliDobanzi: number;
  venituriDobanzi: number;
  cheltuieliPersonal: number;
  chirii: number;
  impozitProfit: number;
  rezultatBrut: number;
  profitNet: number;
  ebit: number;
  ebitda: number;
  capexYtd: number;
  stocuri: number;
  creanteClienti: number;
  cash: number;
  activeCurente: number;
  datoriiCurente: number;
  datoriiTermenLung: number;
  datoriiFinanciare: number;
  furnizori: number;
  capitalPropriu: number;
  totalActiv: number;
  venituriChirii: number;
  reparatiiIntretinere: number;
  imobilizariNete: number;
  /** Share (%) of YTD customer cash-in concentrated in the top 3 partners.
   *  Null when there are no 411 analytic rows with activity. */
  top3ClientiPercent: number | null;
  /** Prior-year same-period cifra de afaceri (YTD). Null when no data. */
  cifraAfaceriAnPrecedent: number | null;
}
