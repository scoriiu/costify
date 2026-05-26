/**
 * Pure function: deduce a fiscal-regime timeline directly from registru jurnal
 * entries.
 *
 * Signal accounts (the impozit expense accounts an accountant credits when
 * accruing tax in Romania):
 *   691 / 4411  -> Impozit pe profit (16%)        -> profit_standard
 *   698 / 4418  -> Impozit pe venit microintrep.  -> profit_micro_1 or _3
 *   697 / 4418  -> Impozit minim cifra de afaceri -> imca
 *   695 / 4411  -> Impozit specific (HoReCa)      -> profit_specific
 *
 * The pair-with-credit-side check matters: 698/4418 unambiguously identifies
 * micro (4418 is the micro-specific debt account), while 691/4411 identifies
 * the standard profit regime (4411 is the profit-tax debt account). Year-end
 * closing entries (`121 = 69x`) are ignored — they shadow the originating
 * accrual and would otherwise double-count.
 *
 * Disambiguating micro_1 (1%) vs micro_3 (3%):
 *   Romanian law: 1% requires ≥1 employee; 3% otherwise.
 *   Heuristic: if any 421 (Personal-salarii) movement exists in the same
 *   fiscal year, classify as micro_1. Otherwise micro_3.
 *
 * Threshold sanity check:
 *   If revenue (credit on 70x) for a year exceeds the micro plafond
 *   (500K EUR ≈ 2,500,000 RON through 2025, 100K EUR ≈ 500,000 RON from 2026),
 *   the firm legally cannot be micro that year. We still report what the
 *   journal says, but emit a warning flag so the accountant sees it.
 *
 * Transitions are snapped to the start of the fiscal year (Jan 1) because
 * Romanian regime changes take effect at year-start. A year with mixed signals
 * (both 691 and 698 booked) is reported with a "mixed" warning so the user
 * can decide whether the firm switched mid-year (over-threshold) or the
 * accountant rebooked the year at close.
 */

import type { JournalEntry } from "@/modules/ingestion/types";
import type { TaxRegime } from "@/modules/accounts";
import {
  DEFAULT_TAX_REGIME,
  resolveRegimeForPeriod,
  type TaxRegimeTransition,
} from "./tax-regime-resolver";

export interface DetectedTransition {
  startDate: Date;
  taxRegime: TaxRegime;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings: string[];
}

export interface DetectorOptions {
  /**
   * If no tax accruals exist in any year, fall back to this regime starting
   * at the very first journal entry. Defaults to "profit_standard".
   */
  fallback?: TaxRegime;
}

interface YearSignal {
  year: number;
  profitStandard: number; // total RON debited 691/4411
  microTax: number;       // total RON debited 698/4418
  imcaTax: number;        // total RON debited 697/4418
  specificTax: number;    // total RON debited 695/4411
  hasSalaries: boolean;   // any 421 movement
  revenue: number;        // total credit on 70x
}

const MICRO_THRESHOLD_BEFORE_2026 = 2_500_000;
const MICRO_THRESHOLD_FROM_2026 = 500_000;

function microThresholdFor(year: number): number {
  return year >= 2026 ? MICRO_THRESHOLD_FROM_2026 : MICRO_THRESHOLD_BEFORE_2026;
}

function isOriginatingTaxEntry(e: JournalEntry): boolean {
  const d = e.contDBase;
  const c = e.contCBase;
  if (d === "691" && c === "4411") return true;
  if (d === "698" && c === "4418") return true;
  if (d === "697" && c === "4418") return true;
  if (d === "695" && (c === "4411" || c === "4418")) return true;
  return false;
}

function buildYearSignals(entries: JournalEntry[]): Map<number, YearSignal> {
  const signals = new Map<number, YearSignal>();

  const ensure = (year: number): YearSignal => {
    let s = signals.get(year);
    if (!s) {
      s = {
        year,
        profitStandard: 0,
        microTax: 0,
        imcaTax: 0,
        specificTax: 0,
        hasSalaries: false,
        revenue: 0,
      };
      signals.set(year, s);
    }
    return s;
  };

  for (const e of entries) {
    if (isOriginatingTaxEntry(e)) {
      const s = ensure(e.year);
      if (e.contDBase === "691") s.profitStandard += e.suma;
      else if (e.contDBase === "698") s.microTax += e.suma;
      else if (e.contDBase === "697") s.imcaTax += e.suma;
      else if (e.contDBase === "695") s.specificTax += e.suma;
    }
    if (e.contDBase === "421" || e.contCBase === "421") {
      ensure(e.year).hasSalaries = true;
    }
    if (e.contCBase && e.contCBase.startsWith("70")) {
      ensure(e.year).revenue += e.suma;
    }
  }

  return signals;
}

function classifyYear(s: YearSignal): {
  regime: TaxRegime | null;
  confidence: "high" | "medium" | "low";
  reason: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const hasProfit = s.profitStandard > 0;
  const hasMicro = s.microTax > 0;
  const hasImca = s.imcaTax > 0;
  const hasSpecific = s.specificTax > 0;
  const totalSignals = [hasProfit, hasMicro, hasImca, hasSpecific].filter(Boolean).length;

  if (totalSignals === 0) {
    return { regime: null, confidence: "low", reason: "Niciun impozit acumulat in anul curent", warnings };
  }

  if (totalSignals > 1) {
    warnings.push(
      `Anul ${s.year} are semnale multiple: 691=${s.profitStandard.toFixed(0)} 698=${s.microTax.toFixed(0)} 697=${s.imcaTax.toFixed(0)} 695=${s.specificTax.toFixed(0)}. Posibila tranzitie mid-an sau rebooking la inchidere.`
    );
  }

  const ranked: Array<[TaxRegime, number]> = [
    ["profit_standard", s.profitStandard],
    ["imca", s.imcaTax],
    ["profit_specific", s.specificTax],
  ];
  // micro needs salary check
  if (hasMicro) {
    const microRegime: TaxRegime = s.hasSalaries ? "profit_micro_1" : "profit_micro_3";
    ranked.push([microRegime, s.microTax]);
  }
  ranked.sort((a, b) => b[1] - a[1]);
  const [winner, winnerAmount] = ranked[0];

  // Threshold sanity for micro
  if ((winner === "profit_micro_1" || winner === "profit_micro_3") && s.revenue > microThresholdFor(s.year)) {
    warnings.push(
      `Cifra de afaceri ${s.revenue.toFixed(0)} RON in ${s.year} depaseste plafonul micro (${microThresholdFor(s.year)} RON). Firma ar trebui sa fie pe profit_standard.`
    );
  }

  const confidence: "high" | "medium" | "low" =
    totalSignals === 1 ? "high" : winnerAmount > 0 ? "medium" : "low";

  return {
    regime: winner,
    confidence,
    reason: `${winner} (${winnerAmount.toFixed(2)} RON acumulat in ${s.year})`,
    warnings,
  };
}

function firstEntryYear(entries: JournalEntry[]): number | null {
  let min = Infinity;
  for (const e of entries) if (e.year < min) min = e.year;
  return Number.isFinite(min) ? min : null;
}

export function detectTaxRegimeTimeline(
  entries: JournalEntry[],
  options: DetectorOptions = {}
): DetectedTransition[] {
  const fallback: TaxRegime = options.fallback ?? "profit_standard";
  if (entries.length === 0) return [];

  const signals = buildYearSignals(entries);
  const firstYear = firstEntryYear(entries);
  if (firstYear === null) return [];

  const lastYear = Math.max(...signals.keys(), firstYear);

  let currentRegime: TaxRegime | null = null;
  const transitions: DetectedTransition[] = [];

  for (let y = firstYear; y <= lastYear; y++) {
    const sig = signals.get(y);
    if (!sig) continue;
    const classification = classifyYear(sig);
    if (!classification.regime) continue;

    if (classification.regime !== currentRegime) {
      transitions.push({
        startDate: new Date(Date.UTC(y, 0, 1)),
        taxRegime: classification.regime,
        confidence: classification.confidence,
        reason: classification.reason,
        warnings: classification.warnings,
      });
      currentRegime = classification.regime;
    } else if (classification.warnings.length > 0) {
      // Same regime carries forward; surface warnings on the existing entry.
      transitions[transitions.length - 1].warnings.push(...classification.warnings);
    }
  }

  if (transitions.length === 0) {
    transitions.push({
      startDate: new Date(Date.UTC(firstYear, 0, 1)),
      taxRegime: fallback,
      confidence: "low",
      reason: "Niciun impozit nu a fost acumulat in jurnal; regim implicit",
      warnings: [],
    });
  }

  return transitions;
}

export interface DetectedRegimeForPeriod {
  taxRegime: TaxRegime;
  /** The transition that covers this period, or null if pre-history (fallback used). */
  source: DetectedTransition | null;
  /** True when the period predates any detected transition (fallback was used). */
  isFallback: boolean;
}

/**
 * Convenience: detect the regime timeline from the journal and resolve which
 * regime applies for a given (year, month). This is what the UI calls every
 * time the user selects a different month — the displayed "Regim fiscal"
 * badge always reflects what the journal says for that period.
 */
export function detectRegimeForPeriod(
  entries: JournalEntry[],
  year: number,
  month: number,
  options: DetectorOptions = {}
): DetectedRegimeForPeriod {
  const fallback = options.fallback ?? DEFAULT_TAX_REGIME;
  const timeline = detectTaxRegimeTimeline(entries, options);
  if (timeline.length === 0) {
    return { taxRegime: fallback, source: null, isFallback: true };
  }
  const asResolverInput: TaxRegimeTransition[] = timeline.map((t) => ({
    startDate: t.startDate,
    taxRegime: t.taxRegime,
  }));
  const resolved = resolveRegimeForPeriod(asResolverInput, year, month, fallback);
  const cutoff = new Date(Date.UTC(year, month, 0)).getTime();
  let source: DetectedTransition | null = null;
  for (const t of timeline) {
    if (t.startDate.getTime() > cutoff) continue;
    if (!source || t.startDate.getTime() > source.startDate.getTime()) source = t;
  }
  return {
    taxRegime: resolved,
    source,
    isFallback: source === null,
  };
}
