/**
 * Pure aggregation logic for partner-level rulaj on a cost or revenue cont.
 *
 * The journal arrives as a sequence of (contD, contC, suma) lines. For a
 * given 6xx (expense) or 7xx (revenue) cont, the "partner" of a line is the
 * analytic on the opposite side — typically 401.xxx for suppliers, 411.xxx
 * for clients, 421/425 for employees. The JournalPartner table tells us
 * which extracted name corresponds to which analytic.
 *
 * This module is intentionally I/O-free. The loader (loader.ts) fetches the
 * inputs from Prisma and calls aggregatePartnersForCont() to compute the
 * partner entries. Same separation keeps the aggregation testable without
 * spinning up a database.
 */
import { normalizePartnerName } from "@/lib/partner-normalize";
import { round2 } from "@/lib/money";
import type {
  PartnerCategoryOverrideRow,
  PartnerEntry,
} from "./types";

/**
 * Minimal shape of a journal line we need for aggregation. The loader maps
 * Prisma rows (with Decimal `suma`) into this shape before calling us.
 */
export interface JournalLineForAggregation {
  contD: string;
  contDBase: string;
  contC: string;
  contCBase: string;
  /** Already converted to plain number; loader handles the Decimal cast. */
  suma: number;
}

export type ContKind = "expense" | "revenue";

/**
 * The aggregation result for one cont. Partners are sorted descending by
 * rulaj — materialitatea conduce: contabilul vede întâi banii mari.
 */
export interface PartnerAggregationResult {
  partners: PartnerEntry[];
  /** Sum across all partners that mapped to a known JournalPartner row. */
  partnerRulaj: number;
  /** Sum of lines where we couldn't resolve a partner (opposite-side cont
   *  wasn't in JournalPartner). Bucketed as "Fara partener identificat" by
   *  the UI. */
  unresolvedRulaj: number;
}

/**
 * Compute partner entries for one contBase, given the relevant journal lines,
 * the partner-name map, and the active overrides.
 *
 * @param contKind        "expense" for 6xx (partner on credit), "revenue"
 *                        for 7xx (partner on debit).
 * @param lines           All journal lines that touch this cont in the
 *                        selected period, already filtered.
 * @param partnerNames    analyticAccount -> partner name. From
 *                        getPartnerNames(clientId) or equivalent.
 * @param overridesForCont  PartnerCategoryOverride rows where contBase
 *                        matches the cont we're aggregating. Used to attach
 *                        the override to the corresponding partner entry.
 * @param crossContOverrides  Optional. ALL overrides for this client
 *                        across every cont. Used to infer suggestions for
 *                        partners on this cont who don't yet have an
 *                        override here but have one elsewhere. Sprint 4.
 *                        Defaults to empty (no suggestion inference).
 */
export function aggregatePartnersForCont(
  contKind: ContKind,
  lines: JournalLineForAggregation[],
  partnerNames: Map<string, string>,
  overridesForCont: PartnerCategoryOverrideRow[],
  crossContOverrides: PartnerCategoryOverrideRow[] = []
): PartnerAggregationResult {
  // Bucket lines by partner name (the OPPOSITE-side analytic's mapped name).
  // We keep one representative original spelling per normalized key — first
  // one wins for display. The normalized key is what we match against
  // overrides + collapse OMV / OMV SRL / Omv. into one row.
  const byKey = new Map<
    string,
    { nameOriginal: string; rulaj: number }
  >();
  let unresolvedRulaj = 0;

  for (const line of lines) {
    const partnerAnalytic = contKind === "expense" ? line.contC : line.contD;
    const rawName = partnerNames.get(partnerAnalytic);
    if (!rawName || rawName.trim() === "") {
      unresolvedRulaj += line.suma;
      continue;
    }
    const key = normalizePartnerName(rawName);
    if (key === "") {
      unresolvedRulaj += line.suma;
      continue;
    }
    const existing = byKey.get(key);
    if (existing) {
      existing.rulaj += line.suma;
    } else {
      byKey.set(key, { nameOriginal: rawName.trim(), rulaj: line.suma });
    }
  }

  // Index overrides by their normalized name for O(1) attachment.
  const overrideByKey = new Map<string, PartnerCategoryOverrideRow>();
  for (const o of overridesForCont) {
    overrideByKey.set(o.partnerNameNormalized, o);
  }

  // Sprint 4 — build the suggestion index from cross-cont overrides. For
  // each partner key, find their overrides on OTHER conts in this client.
  // When exactly one category emerges as the strict majority (or sole
  // choice), suggest it. Multiple competing categories → no suggestion
  // (don't pick a side blindly).
  //
  // Identify the "current cont" by looking at overridesForCont (all of them
  // share the same contBase by construction). When that's empty we infer
  // from journal lines via the first matching entry, falling back to
  // null — in which case any cross-cont entry that happens to use the same
  // contBase will be incorrectly included, but that's a caller bug.
  const currentContBase =
    overridesForCont[0]?.contBase ??
    inferContBaseFromLines(contKind, lines) ??
    null;
  const suggestionByKey = buildSuggestionIndex(
    crossContOverrides,
    currentContBase
  );

  const partners: PartnerEntry[] = [];
  let partnerRulaj = 0;
  for (const [key, bucket] of byKey.entries()) {
    const override = overrideByKey.get(key) ?? null;
    const rulaj = round2(bucket.rulaj);
    partners.push({
      nameNormalized: key,
      // Prefer the spelling captured at override-creation time when an
      // override exists (the contabil's choice of canonical spelling), but
      // fall back to whatever we see in the journal when there's no override.
      nameOriginal: override?.partnerNameOriginal ?? bucket.nameOriginal,
      rulaj,
      override,
      // Suggestion only matters when there's no override yet. A partner
      // with a confirmed override doesn't need a suggestion arrow.
      suggestedCategoryId: override === null ? suggestionByKey.get(key) ?? null : null,
    });
    partnerRulaj += rulaj;
  }

  // Surface an override-only entry (no journal activity this period) so the
  // contabil sees the historical mapping even when the partner is idle. The
  // override carries weight as a "this is how we ALWAYS classify this
  // partner" decision, not just for the periods where they happen to invoice.
  for (const o of overridesForCont) {
    if (!byKey.has(o.partnerNameNormalized)) {
      partners.push({
        nameNormalized: o.partnerNameNormalized,
        nameOriginal: o.partnerNameOriginal,
        rulaj: 0,
        override: o,
        suggestedCategoryId: null, // has its own override already
      });
    }
  }

  // Sort: active partners first by rulaj DESC, then idle override-only ones
  // (rulaj=0) alphabetically at the bottom.
  partners.sort((a, b) => {
    if (a.rulaj !== b.rulaj) return b.rulaj - a.rulaj;
    return a.nameOriginal.localeCompare(b.nameOriginal);
  });

  return {
    partners,
    partnerRulaj: round2(partnerRulaj),
    unresolvedRulaj: round2(unresolvedRulaj),
  };
}

/**
 * Compute a lightweight per-cont summary suitable for the main listing. Same
 * inputs as aggregatePartnersForCont but only returns counts + sums — the UI
 * uses this for the per-cont coverage bar and the "[Vezi parteneri →]"
 * badge ("48 parteneri · 65%") without loading full partner detail into the
 * page bundle.
 *
 * Sprint 2 definition of "mapped at partner level": the partner has an
 * override row. Sprint 6 will treat this dimension as Nivel 1 in the
 * resolution chain; for now we just surface the count.
 */
export interface PartnerSummary {
  partnerCount: number;
  mappedPartnerCount: number;
  /** Sprint 4: count of partners with a cross-cont suggestion waiting for
   *  the contabil's confirmation. A partner can't be both mapped and
   *  suggested — mapping wins (it's already a decision). */
  suggestedPartnerCount: number;
  /** Sum across all partner entries (resolved). Equals partnerRulaj. */
  totalPartnerRulaj: number;
  /** Sum across partners that have an override. */
  overriddenRulaj: number;
  unresolvedRulaj: number;
}

export function summarizePartnersForCont(
  contKind: ContKind,
  lines: JournalLineForAggregation[],
  partnerNames: Map<string, string>,
  overridesForCont: PartnerCategoryOverrideRow[],
  crossContOverrides: PartnerCategoryOverrideRow[] = []
): PartnerSummary {
  const { partners, partnerRulaj, unresolvedRulaj } =
    aggregatePartnersForCont(
      contKind,
      lines,
      partnerNames,
      overridesForCont,
      crossContOverrides
    );

  let mappedPartnerCount = 0;
  let suggestedPartnerCount = 0;
  let overriddenRulaj = 0;
  for (const p of partners) {
    if (p.override !== null) {
      mappedPartnerCount += 1;
      overriddenRulaj += p.rulaj;
    } else if (p.suggestedCategoryId !== null) {
      suggestedPartnerCount += 1;
    }
  }

  return {
    partnerCount: partners.length,
    mappedPartnerCount,
    suggestedPartnerCount,
    totalPartnerRulaj: partnerRulaj,
    overriddenRulaj: round2(overriddenRulaj),
    unresolvedRulaj,
  };
}

/**
 * For each partner key that has overrides on OTHER conts (not the current
 * one), pick the single dominant categoryId — when one category wins by
 * strict majority (count > all-others combined), use that. When multiple
 * categories tie or split, return no suggestion for that key. Conservative
 * by design: we never pick a side for the contabil.
 *
 * @param currentContBase Excludes overrides on this contBase from the
 *    suggestion pool — they're either already attached as actual overrides
 *    or genuinely irrelevant. null = include everything (degenerate case,
 *    only when we can't infer the current cont from inputs).
 */
function buildSuggestionIndex(
  crossContOverrides: PartnerCategoryOverrideRow[],
  currentContBase: string | null
): Map<string, string> {
  if (crossContOverrides.length === 0) return new Map();

  // Bucket category counts per partner key, excluding overrides on the
  // current cont (already attached) so they don't double-count.
  const counts = new Map<string, Map<string, number>>();
  for (const o of crossContOverrides) {
    if (currentContBase !== null && o.contBase === currentContBase) continue;
    let perKey = counts.get(o.partnerNameNormalized);
    if (!perKey) {
      perKey = new Map();
      counts.set(o.partnerNameNormalized, perKey);
    }
    perKey.set(o.categoryId, (perKey.get(o.categoryId) ?? 0) + 1);
  }

  const out = new Map<string, string>();
  for (const [key, byCategory] of counts.entries()) {
    let bestCategory: string | null = null;
    let bestCount = 0;
    let totalForKey = 0;
    for (const [cat, count] of byCategory.entries()) {
      totalForKey += count;
      if (count > bestCount) {
        bestCount = count;
        bestCategory = cat;
      }
    }
    // Strict-majority rule: best > (total - best). With one occurrence
    // (totalForKey===1), that's trivially true → suggestion stands. With
    // a 50/50 split, no suggestion. With a clear winner, suggestion stands.
    if (bestCategory && bestCount > totalForKey - bestCount) {
      out.set(key, bestCategory);
    }
  }
  return out;
}

/** Try to infer the current contBase from the journal lines passed in. For
 *  expense conts the contDBase is the cost-cont side; for revenue the
 *  contCBase. Returns null when lines are empty. */
function inferContBaseFromLines(
  contKind: ContKind,
  lines: JournalLineForAggregation[]
): string | null {
  if (lines.length === 0) return null;
  return contKind === "expense" ? lines[0].contDBase : lines[0].contCBase;
}
