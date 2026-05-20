/**
 * Resolve a Romanian chart-of-accounts cont to its CostCategory for a client.
 *
 * Pure functions in this file — they take a pre-loaded set of mappings and a
 * pre-loaded category tree. The caller (compute layer or owner snapshot) is
 * responsible for fetching those once per request and reusing them across
 * many cont lookups.
 *
 * Algorithm (deterministic, well-defined):
 *
 *   1. Exact analytic match
 *      Look for a mapping with scope="analytic" and cont = inputCont. This is
 *      the precise override (e.g. "628.01 NOLICH" → "Servicii IT" while the
 *      base "628" stays on "Servicii externe").
 *
 *   2. contBase match
 *      Compute getContBase(inputCont). Look for a mapping with
 *      scope="contBase" and cont = base.
 *
 *   3. Prefix walk
 *      Walk shorter prefixes of the base ("628" → "62" → "6") and look for
 *      a contBase mapping at each step. First hit wins.
 *
 *   4. Fall through
 *      Return null. The caller falls back to the hardcoded OMFP labels from
 *      PR-2a so the patron view never goes blank.
 */

import type { CostCategoryNode, MappingScope, ResolvedCategory } from "./types";
import { getContBase } from "@/lib/accounts";

export interface ResolverState {
  /** All categories for the client, indexed by id. Tree is materialized via
   *  `children` arrays already, but we also need a flat lookup for "find by
   *  id when walking ancestors". */
  byId: Map<string, CostCategoryNode>;
  /** All mappings, indexed by cont (the unique-per-client key in DB). */
  byCont: Map<string, { categoryId: string; scope: MappingScope }>;
}

/** Build the resolver state from raw DB rows. Cheap O(n). */
export function buildResolverState(
  categories: CostCategoryNode[],
  mappings: Array<{ cont: string; categoryId: string; scope: MappingScope }>
): ResolverState {
  const byId = new Map<string, CostCategoryNode>();
  for (const node of flattenTree(categories)) {
    byId.set(node.id, node);
  }
  const byCont = new Map<string, { categoryId: string; scope: MappingScope }>();
  for (const m of mappings) {
    byCont.set(m.cont, { categoryId: m.categoryId, scope: m.scope });
  }
  return { byId, byCont };
}

/**
 * Resolve one cont to a category, or null if nothing in the tree matches.
 * Pure: no I/O, no async. Safe to call in a hot loop over thousands of rows.
 */
export function resolveCategoryForCont(
  cont: string,
  state: ResolverState
): ResolvedCategory | null {
  const analytic = state.byCont.get(cont);
  if (analytic && analytic.scope === "analytic") {
    return buildResolution(analytic.categoryId, "analytic", state);
  }

  const base = getContBase(cont);
  const baseHit = state.byCont.get(base);
  if (baseHit && baseHit.scope === "contBase") {
    return buildResolution(baseHit.categoryId, "contBase", state);
  }

  // Walk shorter prefixes ("641" -> "64" -> "6"). The minimum is 1 digit so
  // a top-of-class mapping on "6" or "7" catches everything that doesn't have
  // a more specific match.
  for (let len = base.length - 1; len >= 1; len--) {
    const prefix = base.slice(0, len);
    const hit = state.byCont.get(prefix);
    if (hit && hit.scope === "contBase") {
      return buildResolution(hit.categoryId, "contBase", state);
    }
  }

  return null;
}

function buildResolution(
  categoryId: string,
  matchedScope: MappingScope,
  state: ResolverState
): ResolvedCategory | null {
  const node = state.byId.get(categoryId);
  if (!node) return null;

  const path: CostCategoryNode[] = [];
  let current: CostCategoryNode | undefined = node;
  while (current) {
    path.unshift(current);
    current = current.parentId ? state.byId.get(current.parentId) : undefined;
  }

  return { category: node, path, matchedScope };
}

function* flattenTree(roots: CostCategoryNode[]): Generator<CostCategoryNode> {
  for (const root of roots) {
    yield root;
    yield* flattenTree(root.children);
  }
}
