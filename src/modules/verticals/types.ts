/**
 * Types for the per-client business vertical model (Axa B in PR-2c).
 *
 * A Vertical is a "line of business" the patron tracks separately:
 *   - QHM21 NETWORK SRL has Outsourcing, Recruitment, Coworking
 *   - A construction firm has Proiect Bucuresti, Proiect Cluj, Service
 *   - A restaurant has Sala, Catering, Delivery
 *
 * Verticals are STRICTLY PER FIRM. Two clients can both have "Outsourcing"
 * but they are different rows isolated by clientId.
 *
 * Allocation chains a chart-of-accounts cont to one or more verticals with
 * percentage splits. A row mapping "605 -> [{Outsourcing,60}, {Coworking,40}]"
 * says: every monetary movement on class 605 splits 60/40 between those two
 * verticals. Accounts without an allocation roll up to the default vertical
 * ("Toata firma" by convention).
 */

export type AllocationScope = "contBase" | "analytic";

/** One slice of a split. Sum of `percent` across the splits of an allocation
 *  must be exactly 100. */
export interface AllocationSplit {
  verticalId: string;
  percent: number; // integer 1..100
}

/** A vertical row enriched with display info for the UI. */
export interface VerticalView {
  id: string;
  clientId: string;
  name: string;
  position: number;
  isDefault: boolean;
  /** How many allocations target this vertical at any percent > 0.
   *  Pre-computed once per request. */
  allocationCount: number;
}

/** One allocation row with its splits parsed and validated. */
export interface AllocationView {
  id: string;
  clientId: string;
  scope: AllocationScope;
  cont: string;
  splits: AllocationSplit[];
}

/** The resolved verticals for one cont. Always non-empty: if no rule matches,
 *  the caller's resolver returns the default vertical at 100%. */
export interface ResolvedAllocation {
  splits: AllocationSplit[];
  /** Which scope matched, or "default" when we fell through to the firm's
   *  default vertical. */
  matchedScope: AllocationScope | "default";
}
