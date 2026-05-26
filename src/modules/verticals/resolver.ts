/**
 * Resolve a chart-of-accounts cont to its vertical splits for a client.
 *
 * Pure functions — caller pre-loads the allocations + the default vertical
 * once per request and reuses across many cont lookups in a hot path.
 *
 * Algorithm (deterministic):
 *   1. Look up `scope=analytic` allocation for the exact cont.
 *   2. Look up `scope=contBase` for getContBase(cont).
 *   3. Walk shorter prefixes ("628" -> "62" -> "6") for a contBase hit.
 *   4. Fall through to the default vertical at 100%.
 *
 * The result is always non-empty (at minimum, the default at 100%).
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
  /** Category-level allocations indexed by categoryId. Used by the
   *  partner-override residue pathway: when an override redirects rulaj to
   *  a target category, we consult this map to decide which lines of business
   *  receive that money before falling back to the default vertical. */
  byCategoryId: Map<string, CategoryAllocationView>;
  /** Vertical id used as fallback when nothing else matches. Must always be set
   *  when verticalsEnabled = true. */
  defaultVerticalId: string;
}

export function buildVerticalResolver(
  allocations: AllocationView[],
  defaultVerticalId: string,
  categoryAllocations: CategoryAllocationView[] = []
): VerticalResolverState {
  const byCont = new Map<string, AllocationView>();
  for (const a of allocations) byCont.set(a.cont, a);
  const byCategoryId = new Map<string, CategoryAllocationView>();
  for (const c of categoryAllocations) byCategoryId.set(c.categoryId, c);
  return { byCont, byCategoryId, defaultVerticalId };
}

export function resolveAllocationForCont(
  cont: string,
  state: VerticalResolverState
): ResolvedAllocation {
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

  return {
    splits: [{ verticalId: state.defaultVerticalId, percent: 100 }],
    matchedScope: "default",
  };
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
  return {
    splits: [{ verticalId: state.defaultVerticalId, percent: 100 }],
    matchedScope: "default",
  };
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
