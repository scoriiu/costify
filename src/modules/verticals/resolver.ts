/**
 * Resolve a chart-of-accounts cont to its vertical splits for a client.
 *
 * Pure functions — caller pre-loads the allocations + the default vertical
 * once per request and reuses across many cont lookups in a hot path.
 *
 * Cascade (most-specific wins) — see docs/internal/mapari-unified-cascade-plan.md:
 *   1. Cont rule: `scope=analytic` for the exact cont.
 *   2. Cont rule: `scope=contBase` for getContBase(cont), then shorter
 *      prefixes ("628" -> "62" -> "6").
 *   3. CATEGORY rule: the split set on the cont's CostCategory. This is the
 *      primary unit the accountant edits — "Marfa → 40% Outsourcing /
 *      60% Recruiting" cascades to every cont (and partner) in that category.
 *   4. FIRM-TOP default: the firm-wide split that fills everything not set
 *      more specifically.
 *   5. Legacy fallback: the default vertical at 100%.
 *
 * The result is always non-empty (at minimum, the default at 100%).
 *
 * Partner-level overrides (the most specific level) are resolved upstream
 * before this function is consulted — they don't live in this resolver.
 */

import { getContBase } from "@/lib/accounts";
import type {
  AllocationScope,
  AllocationSplit,
  AllocationView,
  CategoryAllocationView,
  ResolvedAllocation,
} from "./types";

export interface VerticalResolverState {
  /** Cont-level allocations indexed by cont for O(1) lookup. */
  byCont: Map<string, AllocationView>;
  /** Category-level allocations indexed by categoryId. Drives BOTH the
   *  partner-override residue pathway AND direct cont resolution: a cont
   *  with no own rule inherits its category's split. */
  byCategoryId: Map<string, CategoryAllocationView>;
  /** Firm-wide default split — the top of the cascade. null = not configured,
   *  in which case resolution falls through to `defaultVerticalId` at 100%. */
  firmDefaultSplits: AllocationSplit[] | null;
  /** Vertical id used as the last-resort fallback when nothing else matches.
   *  `null` when the firm has no default vertical — in that case unmatched
   *  conts resolve to an EMPTY split (unallocated) rather than being forced
   *  onto a phantom default. Cont/category/firm rules still resolve normally. */
  defaultVerticalId: string | null;
}

export function buildVerticalResolver(
  allocations: AllocationView[],
  defaultVerticalId: string | null,
  categoryAllocations: CategoryAllocationView[] = [],
  firmDefaultSplits: AllocationSplit[] | null = null
): VerticalResolverState {
  const byCont = new Map<string, AllocationView>();
  for (const a of allocations) byCont.set(a.cont, a);
  const byCategoryId = new Map<string, CategoryAllocationView>();
  for (const c of categoryAllocations) byCategoryId.set(c.categoryId, c);
  return { byCont, byCategoryId, firmDefaultSplits, defaultVerticalId };
}

/**
 * Resolve a cont to its split. `categoryPath` is the cont's resolved
 * CostCategory chain ordered most-specific → root (i.e. [leaf, ..., top]).
 * A split set on ANY category in the chain applies, with the most specific
 * winning — so "Marfa" set on a parent cascades to every child category, cont
 * and partner under it. Pass [] when the cont has no category mapping.
 */
export function resolveAllocationForCont(
  cont: string,
  state: VerticalResolverState,
  categoryPath: string[] = []
): ResolvedAllocation {
  // 1. Cont-level: analytic wins over base wins over shorter prefixes.
  const analytic = state.byCont.get(cont);
  if (analytic && analytic.scope === "analytic") {
    return { splits: analytic.splits, matchedScope: "analytic" };
  }

  const base = getContBase(cont);
  const baseHit = state.byCont.get(base);
  if (baseHit && baseHit.scope === "contBase") {
    return { splits: baseHit.splits, matchedScope: "contBase" };
  }

  for (let len = base.length - 1; len >= 1; len--) {
    const prefix = base.slice(0, len);
    const hit = state.byCont.get(prefix);
    if (hit && hit.scope === "contBase") {
      return { splits: hit.splits, matchedScope: "contBase" };
    }
  }

  // 2. Category-level: the cont inherits the most-specific category in its
  //    chain that has a split (leaf first, then ancestors).
  for (const categoryId of categoryPath) {
    const catHit = state.byCategoryId.get(categoryId);
    if (catHit) return { splits: catHit.splits, matchedScope: "category" };
  }

  // 3. Firm-top default.
  if (state.firmDefaultSplits && state.firmDefaultSplits.length > 0) {
    return { splits: state.firmDefaultSplits, matchedScope: "firm" };
  }

  // 4. Legacy fallback — only when a default vertical exists. Otherwise the
  //    cont is genuinely unallocated (empty split).
  if (state.defaultVerticalId) {
    return {
      splits: [{ verticalId: state.defaultVerticalId, percent: 100 }],
      matchedScope: "default",
    };
  }
  return { splits: [], matchedScope: "default" };
}

/**
 * Resolve a category to its vertical splits. Used by the partner-override
 * residue pathway: when a partner redirects rulaj from a cont to a category,
 * the redirected slice follows the category's allocation if defined, or the
 * firm's default vertical otherwise.
 */
export function resolveAllocationForCategory(
  categoryId: string,
  state: VerticalResolverState
): ResolvedAllocation {
  const hit = state.byCategoryId.get(categoryId);
  if (hit) return { splits: hit.splits, matchedScope: "category" };
  if (state.firmDefaultSplits && state.firmDefaultSplits.length > 0) {
    return { splits: state.firmDefaultSplits, matchedScope: "firm" };
  }
  if (state.defaultVerticalId) {
    return {
      splits: [{ verticalId: state.defaultVerticalId, percent: 100 }],
      matchedScope: "default",
    };
  }
  return { splits: [], matchedScope: "default" };
}

/**
 * Convenience: apply a split to a monetary amount.
 * applySplit(1000, [{vA, 60}, {vB, 40}]) = [{vA, 600}, {vB, 400}].
 * Rounds to 2 decimals; the last slice absorbs any rounding remainder so the
 * sum exactly matches the input amount.
 */
export function applySplit(
  amount: number,
  splits: AllocationSplit[]
): Array<{ verticalId: string; amount: number }> {
  if (splits.length === 0) return [];
  if (splits.length === 1) {
    return [{ verticalId: splits[0].verticalId, amount: round2(amount) }];
  }

  const out: Array<{ verticalId: string; amount: number }> = [];
  let accumulated = 0;
  for (let i = 0; i < splits.length - 1; i++) {
    const slice = round2((amount * splits[i].percent) / 100);
    out.push({ verticalId: splits[i].verticalId, amount: slice });
    accumulated += slice;
  }
  // Last slice absorbs any rounding.
  out.push({
    verticalId: splits[splits.length - 1].verticalId,
    amount: round2(amount - accumulated),
  });
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type { AllocationScope };
