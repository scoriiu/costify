/**
 * Types for the patron-facing cost category taxonomy.
 *
 * The accountant edits a tree of CostCategory per client; each leaf can have
 * zero or more AccountCategoryMapping rows pointing at a Romanian chart-of-
 * accounts entry (either a 3-digit contBase or a fully analytic cont).
 *
 * The OWNER never sees these tables directly — they consume the computed
 * breakdown derived from the tree + journal totals.
 *
 * ---
 * Axa A vs Axa B — read this before extending the model.
 *
 * Sorin's Excel uses TWO independent axes to organize his cashflow:
 *
 *   AXA A — "natura cheltuielii"   (OWNED BY THIS MODULE, PR-2b)
 *     Generic, OMFP-aligned, shareable across firms:
 *       Salarii, Electricitate, Chirie, Marfa, Servicii IT, ...
 *     Every firm — bakery or SaaS or law office — has these.
 *     We seed them from EXPENSE_SEEDS / REVENUE_SEEDS in seed.ts and let the
 *     accountant restructure freely. Mapping is cont → CostCategory.
 *
 *   AXA B — "verticala / linie de business"   (NOT IN THIS MODULE; PR-2c)
 *     Firm-specific. QHM21 has Outsourcing/Recruitment/Coworking. A construction
 *     firm has Proiect-Bucuresti/Proiect-Cluj/Service. A restaurant has
 *     Sala/Catering/Delivery. Most small firms have NONE.
 *     Verticals will live in a separate `Vertical` table with a per-client
 *     `verticalsEnabled` flag. Allocation of journal rows to verticals will use
 *     strategy A+B+E (per-cont fix + split % + pattern rules).
 *
 * The two axes are INTENTIONALLY orthogonal. A line "Electricitate"
 * (CostCategory) at 12.000 lei may decompose 60% Outsourcing / 40% Coworking
 * (Vertical) — same euro, two axes. Do not encode the vertical into the
 * CostCategory name ("Electricitate Outsourcing") — that collapses the model
 * and breaks the moment a firm has more than one vertical.
 */

export type CategoryKind = "expense" | "revenue";

export type MappingScope = "contBase" | "analytic";

/** One node returned by listTree, with already-resolved children inlined. */
export interface CostCategoryNode {
  id: string;
  clientId: string;
  parentId: string | null;
  name: string;
  kind: CategoryKind;
  position: number;
  isOmfpDefault: boolean;
  children: CostCategoryNode[];
  /** How many mappings target this node directly (not via descendants). */
  mappingCount: number;
}

/** Output of the resolver: which category a given cont rolls up to. */
export interface ResolvedCategory {
  category: CostCategoryNode;
  /** Path from root to this category, top-down. Used for breadcrumbs. */
  path: CostCategoryNode[];
  /** Which mapping row matched ("analytic" beats "contBase"). null when we
   *  fell through to the hardcoded OMFP fallback labels from PR-2a. */
  matchedScope: MappingScope | null;
}

/** One mapping row in DB form, suitable for service-layer use. */
export interface AccountMappingRow {
  id: string;
  clientId: string;
  scope: MappingScope;
  cont: string;
  categoryId: string;
}

/** Owner-facing breakdown item produced from the category tree.
 *  Same shape as PR-2a's CategoryBreakdownItem — kept structurally compatible
 *  on purpose so the UI keeps rendering with zero changes when categories
 *  exist or not. */
export interface CategoryBreakdownItem {
  /** Stable id for React keys; categoryId when category-backed, "code:NN"
   *  when falling back to the OMFP 2-digit grouping. */
  id: string;
  label: string;
  value: number;
  percent: number;
}
