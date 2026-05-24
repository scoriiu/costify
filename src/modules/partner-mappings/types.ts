/**
 * Types for the partner-level override layer of the Mapari Cashflow feature
 * (see docs/ro/cashflow-limbajul-mapari.md §3-§9).
 *
 * Distinction between *override* and *partner entry*:
 *   - PartnerCategoryOverrideRow = persisted decision in the DB.
 *   - PartnerEntry = what the UI shows on a cont: every partner that has
 *     activity on the cont in the selected year, with their rulaj and (if
 *     present) the override that applies to them.
 */

export type PartnerOverrideSource = "manual" | "bulk" | "suggested";

export interface PartnerCategoryOverrideRow {
  id: string;
  clientId: string;
  contBase: string;
  partnerNameNormalized: string;
  partnerNameOriginal: string;
  categoryId: string;
  source: PartnerOverrideSource;
  /** Null = sugerat de sistem, asteapta confirmare. Set = confirmat de contabil. */
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One row in the partner panel for a given cont, with the rulaj observed on
 * that cont in the selected year plus the override (if any) that decides
 * which category applies to this partner's slice.
 */
export interface PartnerEntry {
  /** Normalised name — stable across spellings. The matching key. */
  nameNormalized: string;
  /** Spelling we display in the UI. Comes from the journal partner names. */
  nameOriginal: string;
  /** YTD-cumulated rulaj of this partner on this cont, in RON. */
  rulaj: number;
  /** Override that decides this partner's category, if any. */
  override: PartnerCategoryOverrideRow | null;
}
