/**
 * Pure helpers for the partner-panel filter chain. Extracted so the same
 * filter logic that drives the rendered list ALSO drives the bulk action's
 * target set — guaranteeing what the contabil sees on screen is exactly
 * what the bulk button would write.
 *
 * No React imports. No DOM. Unit-tested in isolation.
 */

import type { PartnerEntry } from "./types";

export type PartnerFilter = "all" | "unmapped" | "top10";

/**
 * Diacritic-insensitive lowercase normalizer for the search box. NFD splits
 * "Țiriac" → ['T', combining cedilla], then we strip the combining marks so
 * "tiriac" matches "Țiriac". Distinct from partner-key normalization which
 * preserves diacritics on purpose.
 */
export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Apply the toggle filter + search box + minRulaj threshold to a partners
 * list. Returns rows in the same order as the input (Top10 is a prefix
 * slice on the already-sorted input array). Used for the rendered list AND
 * as the base for bulk targets, so they can't drift apart.
 *
 * Filter ORDER matters:
 *   1. Toggle (Toti / Fara exceptie / Top10) — drops by category state.
 *   2. minRulaj — drops below-threshold partners (materialitate cutoff).
 *   3. Search — drops by name match.
 *
 * The Top10 toggle is applied BEFORE the threshold so "Top10 + peste 5000"
 * means "of the top 10 by rulaj, those over 5000 lei". This is the
 * intuitive reading — "top 10 mari, dar doar cele peste pragul X".
 */
export function filterPartners(
  partners: PartnerEntry[],
  filter: PartnerFilter,
  query: string,
  minRulaj: number = 0
): PartnerEntry[] {
  let xs = partners;
  if (filter === "unmapped") xs = xs.filter((p) => p.override === null);
  else if (filter === "top10") xs = xs.slice(0, 10);
  if (minRulaj > 0) xs = xs.filter((p) => p.rulaj >= minRulaj);
  const q = normalizeForSearch(query);
  if (q) {
    xs = xs.filter((p) => normalizeForSearch(p.nameOriginal).includes(q));
  }
  return xs;
}

/**
 * Compute the set of partners a bulk-apply action would touch given the
 * current filter + search state. Two layers:
 *
 *   1. The user's visible filter chain (toggle + search).
 *   2. By default, drop partners that already have a manual override —
 *      bulk's safe semantics is "fill in the blanks", not "overwrite".
 *
 * Pass `includeOverridden: true` for the explicit overwrite flow (Item #6).
 */
export function computeBulkTargets(
  partners: PartnerEntry[],
  filter: PartnerFilter,
  query: string,
  options: { includeOverridden?: boolean; minRulaj?: number } = {}
): PartnerEntry[] {
  const visible = filterPartners(partners, filter, query, options.minRulaj ?? 0);
  if (options.includeOverridden) return visible;
  return visible.filter((p) => p.override === null);
}

/**
 * Sum the rulaj of a partners list. Tiny helper, but used in three places
 * (visible total, bulk preview, coverage detail) so naming it once keeps
 * the call-sites readable.
 */
export function sumRulaj(partners: PartnerEntry[]): number {
  return partners.reduce((sum, p) => sum + p.rulaj, 0);
}

/**
 * Compute the maximum rulaj across a partners list. Used by the rulaj-bar
 * column on each row — bars are sized relative to the biggest visible
 * partner so they encode rank at a glance. Recomputed when filters change
 * (so a "Peste 5.000 lei" cutoff doesn't shrink every bar to ~100%).
 */
export function maxRulaj(partners: PartnerEntry[]): number {
  let m = 0;
  for (const p of partners) if (p.rulaj > m) m = p.rulaj;
  return m;
}

/**
 * Compute the percent (0–100) of the rulaj bar fill for one partner row.
 * Pure: tested in isolation. Returns 0 when there's nothing to compare
 * against (max=0) or when this partner has no activity (rulaj<=0), so the
 * bar appears empty rather than guessing.
 */
export function rulajBarPercent(rulaj: number, max: number): number {
  if (max <= 0 || rulaj <= 0) return 0;
  return Math.min(100, (rulaj / max) * 100);
}

/**
 * Result of a Pareto cutoff computation. Splits a sorted-desc partners
 * list into the "head" (partners that together cross a coverage threshold
 * like 80% of total rulaj) and the "tail" (everything below). The contabil
 * sees the head as "what matters" and the tail as "long tail noise".
 */
export interface ParetoCutoff {
  /** Number of partners in the head (always >= 0; may equal partners.length
   *  when one partner is huge or threshold is 100). */
  headCount: number;
  /** Percent of total rulaj covered by the head (0..100, rounded to int).
   *  Equals the threshold OR the smallest cumulative reaching it. */
  headPercent: number;
  /** Number of partners in the tail. Equals partners.length - headCount. */
  tailCount: number;
  /** Percent of total rulaj on the tail (0..100, rounded). */
  tailPercent: number;
  /** Sum of rulaj across all partners — used by the UI to compute absolute
   *  numbers without re-summing. */
  totalRulaj: number;
}

/**
 * Compute the Pareto cutoff: walk a SORTED-DESC partners list adding rulaj
 * until the cumulative crosses `thresholdPercent` (default 80%). The
 * smallest index that crosses defines the head; the rest is the tail.
 *
 * The caller MUST pre-sort partners by rulaj DESC; we don't sort here so
 * the UI can pass the already-sorted aggregator output without copying.
 *
 * Edge cases:
 *   - Empty list → all-zero counts.
 *   - Zero total rulaj → all-zero counts (no signal to extract).
 *   - One huge partner (e.g. 85% alone) → headCount=1.
 *   - All-equal partners → head is roughly threshold% of the count.
 */
export function computeParetoCutoff(
  partners: PartnerEntry[],
  thresholdPercent: number = 80
): ParetoCutoff {
  const totalRulaj = sumRulaj(partners);
  if (partners.length === 0 || totalRulaj <= 0) {
    return {
      headCount: 0,
      headPercent: 0,
      tailCount: partners.length,
      tailPercent: 0,
      totalRulaj: 0,
    };
  }
  const targetRulaj = (thresholdPercent / 100) * totalRulaj;
  let cumulative = 0;
  let headCount = 0;
  for (const p of partners) {
    cumulative += p.rulaj;
    headCount += 1;
    if (cumulative >= targetRulaj) break;
  }
  const headPercent = Math.round((cumulative / totalRulaj) * 100);
  return {
    headCount,
    headPercent,
    tailCount: partners.length - headCount,
    tailPercent: 100 - headPercent,
    totalRulaj,
  };
}

/**
 * Split a target list into two groups: partners that would be NEWLY mapped
 * (no existing override) vs. those that would be OVERWRITTEN (already have
 * a manual override). Used by the bulk preview modal so the contabil sees
 * exactly what will happen before confirming.
 */
export function splitTargetsByExistence(
  targets: PartnerEntry[]
): { fresh: PartnerEntry[]; overwriting: PartnerEntry[] } {
  const fresh: PartnerEntry[] = [];
  const overwriting: PartnerEntry[] = [];
  for (const p of targets) {
    if (p.override === null) fresh.push(p);
    else overwriting.push(p);
  }
  return { fresh, overwriting };
}
