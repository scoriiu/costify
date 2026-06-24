/**
 * Period keys for effective-dated mappings (ADR-0004).
 *
 * A period key is the integer `YYYYMM` (e.g. April 2026 -> 202604). It is
 * monotonic across year boundaries (202612 < 202701), sortable, indexable, and
 * readable in the database. The sentinel `INCEPTION = 0` means "de la inceput":
 * a mapping version with `effectiveFrom = 0` applies to every period, which is
 * how legacy (period-less) mappings are migrated without behavioural change.
 *
 * The journal and the period selector are monthly, so month granularity is the
 * natural grain — reclassifying a cont mid-month is meaningless.
 */

export type PeriodKey = number;

export const INCEPTION: PeriodKey = 0;

export function periodKey(year: number, month: number): PeriodKey {
  return year * 100 + month;
}

export function periodYear(key: PeriodKey): number {
  return Math.floor(key / 100);
}

export function periodMonth(key: PeriodKey): number {
  return key % 100;
}

/**
 * Period keys Jan..month of a year, oldest first. This is the set of months a
 * year-to-date view through `month` aggregates over (D5).
 */
export function ytdPeriods(year: number, month: number): PeriodKey[] {
  const out: PeriodKey[] = [];
  for (let m = 1; m <= month; m++) out.push(periodKey(year, m));
  return out;
}

/** The calendar month immediately before `key`, crossing year boundaries. */
export function previousPeriod(key: PeriodKey): PeriodKey {
  const y = periodYear(key);
  const m = periodMonth(key);
  return m <= 1 ? periodKey(y - 1, 12) : periodKey(y, m - 1);
}

/**
 * The three UI scopes for a mapping write (ADR-0004 D3/D10):
 *   - "all"  -> edit the inception open version (effectiveFrom 0, open).
 *   - "from" -> open version starting at a month, persists onward.
 *   - "only" -> bounded override winning only inside [from, to].
 */
export type MappingScopeKind = "all" | "from" | "only";

export interface MappingPeriodScope {
  kind: MappingScopeKind;
  /** Required for "from" and "only"; ignored for "all". */
  from?: PeriodKey;
  /** Required for "only" (the inclusive end of the window). */
  to?: PeriodKey;
}

export interface EffectiveWindow {
  effectiveFrom: PeriodKey;
  effectiveTo: PeriodKey | null;
}

/** Resolve a UI scope into the row's [effectiveFrom, effectiveTo]. Defaults to
 *  inception ("pentru toate perioadele") when no scope is given. */
export function scopeToWindow(scope?: MappingPeriodScope): EffectiveWindow {
  if (!scope || scope.kind === "all") {
    return { effectiveFrom: INCEPTION, effectiveTo: null };
  }
  if (scope.kind === "from") {
    if (scope.from === undefined) throw new Error("scope 'from' requires a period");
    return { effectiveFrom: scope.from, effectiveTo: null };
  }
  if (scope.from === undefined || scope.to === undefined) {
    throw new Error("scope 'only' requires from and to periods");
  }
  if (scope.to < scope.from) throw new Error("scope 'only' window is inverted");
  return { effectiveFrom: scope.from, effectiveTo: scope.to };
}

/** True when a bounded override [effectiveFrom, effectiveTo] contains `target`.
 *  Open versions (effectiveTo null) are handled by `pickAsOf`, not here. */
export function windowContains(window: EffectiveWindow, target: PeriodKey): boolean {
  if (window.effectiveTo === null) return false;
  return target >= window.effectiveFrom && target <= window.effectiveTo;
}

/**
 * Two-layer resolution (ADR-0004 D3): pick the version effective at `target`.
 *
 *   1. A bounded override (effectiveTo set) whose window contains `target` wins.
 *      The service enforces non-overlap, so there is at most one; if several are
 *      present anyway we take the one with the largest effectiveFrom for
 *      determinism.
 *   2. Otherwise fall back to the open timeline (effectiveTo null) via pickAsOf.
 *
 * Returns null when nothing covers the period (entity unmapped, OMFP fallback).
 * The caller interprets a returned tombstone (categoryId null / empty splits)
 * as "explicitly unmapped here". Pure and allocation-light for hot loops.
 */
export function pickEffective<T extends EffectiveWindow>(
  versions: readonly T[],
  target: PeriodKey
): T | null {
  let bounded: T | null = null;
  for (const v of versions) {
    if (
      v.effectiveTo !== null &&
      target >= v.effectiveFrom &&
      target <= v.effectiveTo &&
      (bounded === null || v.effectiveFrom > bounded.effectiveFrom)
    ) {
      bounded = v;
    }
  }
  if (bounded) return bounded;

  let open: T | null = null;
  for (const v of versions) {
    if (
      v.effectiveTo === null &&
      v.effectiveFrom <= target &&
      (open === null || v.effectiveFrom > open.effectiveFrom)
    ) {
      open = v;
    }
  }
  return open;
}

/**
 * Pick the version effective at `target`: the one with the largest
 * `effectiveFrom` that is still `<= target`. Returns null when every version
 * starts after the target (the entity is unmapped for that period). Pure and
 * allocation-free so it is safe in a hot loop over thousands of conts.
 *
 * The caller decides what a returned version means — in particular a "tombstone"
 * version (e.g. `categoryId === null`) resolves to "explicitly unmapped from
 * here", which is distinct from "no version at all".
 */
export function pickAsOf<T extends { effectiveFrom: PeriodKey }>(
  versions: readonly T[],
  target: PeriodKey
): T | null {
  let best: T | null = null;
  for (const v of versions) {
    if (v.effectiveFrom <= target && (best === null || v.effectiveFrom > best.effectiveFrom)) {
      best = v;
    }
  }
  return best;
}
