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
 * Apply the toggle filter + search box to a partners list. Returns rows in
 * the same order as the input (Top10 is a prefix slice on the already-sorted
 * input array). Used for the rendered list AND as the base for bulk targets.
 */
export function filterPartners(
  partners: PartnerEntry[],
  filter: PartnerFilter,
  query: string
): PartnerEntry[] {
  let xs = partners;
  if (filter === "unmapped") xs = xs.filter((p) => p.override === null);
  else if (filter === "top10") xs = xs.slice(0, 10);
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
  options: { includeOverridden?: boolean } = {}
): PartnerEntry[] {
  const visible = filterPartners(partners, filter, query);
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
