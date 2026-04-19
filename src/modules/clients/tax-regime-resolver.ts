/**
 * Pure function: resolve the active tax regime for a (year, month) period
 * given a timeline of transitions.
 *
 * A TaxRegimeTransition has a `startDate` — the regime applies from that date
 * inclusive until the next transition's startDate (exclusive), or forever if
 * this is the most recent entry.
 *
 * For period (Y, M), pick the transition whose startDate is <= the LAST DAY
 * of that month, ordered by startDate descending, limit 1.
 *
 *   transitions: [
 *     { startDate: 2022-01-01, taxRegime: "profit_micro_1" },
 *     { startDate: 2025-01-01, taxRegime: "profit_standard" },
 *   ]
 *
 *   resolveRegimeForPeriod(transitions, 2024, 12)  // "profit_micro_1"
 *   resolveRegimeForPeriod(transitions, 2025,  1)  // "profit_standard"
 *   resolveRegimeForPeriod(transitions, 2021,  6)  // DEFAULT (no transition applies)
 *
 * If no transition applies (period predates the first transition, or no
 * transitions at all), returns the fallback regime or "profit_standard".
 */

import type { TaxRegime } from "@/modules/accounts";

export interface TaxRegimeTransition {
  startDate: Date;
  taxRegime: TaxRegime;
  reason?: string | null;
}

export const DEFAULT_TAX_REGIME: TaxRegime = "profit_standard";

/** Last day of month as a Date at UTC midnight. */
function lastDayOfMonth(year: number, month: number): Date {
  // new Date(y, m, 0) returns the last day of month m (1-indexed here).
  return new Date(Date.UTC(year, month, 0));
}

export function resolveRegimeForPeriod(
  transitions: TaxRegimeTransition[],
  year: number,
  month: number,
  fallback: TaxRegime = DEFAULT_TAX_REGIME
): TaxRegime {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month ${month}, expected 1-12`);
  }
  const cutoff = lastDayOfMonth(year, month).getTime();

  let best: TaxRegimeTransition | null = null;
  for (const t of transitions) {
    const ts = t.startDate.getTime();
    if (ts > cutoff) continue;
    if (!best || ts > best.startDate.getTime()) {
      best = t;
    }
  }

  return best?.taxRegime ?? fallback;
}

/**
 * Returns sorted transitions (ascending by startDate) — useful for display
 * and for building a "current + history" view.
 */
export function sortTransitionsAsc(
  transitions: TaxRegimeTransition[]
): TaxRegimeTransition[] {
  return [...transitions].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );
}

/**
 * Human-readable label for a TaxRegime value.
 * Used on CPP page and Setari page. Keeps vocabulary centralized.
 */
export function taxRegimeLabel(regime: TaxRegime): string {
  switch (regime) {
    case "profit_standard":
      return "Impozit pe profit (16%)";
    case "profit_micro_1":
      return "Microintreprindere 1%";
    case "profit_micro_3":
      return "Microintreprindere 3%";
    case "profit_specific":
      return "Impozit specific (HoReCa)";
    case "imca":
      return "Impozit minim (IMCA)";
    case "deferred":
      return "Impozit amanat";
  }
}

/** Tax account that carries the charge for a given regime. */
export function taxRegimeAccount(regime: TaxRegime): string {
  switch (regime) {
    case "profit_standard":
      return "691";
    case "profit_micro_1":
    case "profit_micro_3":
    case "deferred":
      return "698";
    case "profit_specific":
      return "695";
    case "imca":
      return "697";
  }
}
