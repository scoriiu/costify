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
 */
export function aggregatePartnersForCont(
  contKind: ContKind,
  lines: JournalLineForAggregation[],
  partnerNames: Map<string, string>,
  overridesForCont: PartnerCategoryOverrideRow[]
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
  overridesForCont: PartnerCategoryOverrideRow[]
): PartnerSummary {
  const { partners, partnerRulaj, unresolvedRulaj } =
    aggregatePartnersForCont(contKind, lines, partnerNames, overridesForCont);

  let mappedPartnerCount = 0;
  let overriddenRulaj = 0;
  for (const p of partners) {
    if (p.override !== null) {
      mappedPartnerCount += 1;
      overriddenRulaj += p.rulaj;
    }
  }

  return {
    partnerCount: partners.length,
    mappedPartnerCount,
    totalPartnerRulaj: partnerRulaj,
    overriddenRulaj: round2(overriddenRulaj),
    unresolvedRulaj,
  };
}
