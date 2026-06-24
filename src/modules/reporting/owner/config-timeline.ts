/**
 * Per-category CONFIGURATION timeline (ADR-0004 D10).
 *
 * The trend chart shows how each cost line evolved in lei. This computes the
 * orthogonal story: how the line's DEFINITION evolved, i.e. which conturi were
 * classified into it each month and when that membership changed. A reclassi-
 * fication ("cont 62 moved from Servicii externe to Marfa from March") becomes
 * a marker on March for both lines: removed from one, added to the other.
 *
 * Keyed by ROOT category id so it lines up 1:1 with the chart's line ids
 * (cost lines are emitted at depth 0 / root only). Pure: no I/O.
 */

import type { CostCategoryNode } from "@/modules/categories";
import type { CategoryMappingVersion } from "@/modules/categories";
import { pickEffective, periodKey, previousPeriod } from "@/lib/period";
import type { SeriesMonth } from "./line-series";

/** One cont entering or leaving a line in a given month, with the other end of
 *  the move (where it came from when added, where it went when removed). */
export interface ContMembershipChange {
  cont: string;
  /** Name of the OTHER line involved, or "nemapat" when none. */
  otherLabel: string;
}

export interface MonthConfigChange {
  added: ContMembershipChange[];
  removed: ContMembershipChange[];
}

/** Map of root-category id -> per-month config changes, aligned 1:1 with the
 *  `months` array passed in. Empty `{added:[],removed:[]}` when nothing changed
 *  that month. A line absent from the map had no configured cont touch it. */
export type CategoryConfigChanges = Record<string, MonthConfigChange[]>;

function emptyMonths(n: number): MonthConfigChange[] {
  return Array.from({ length: n }, () => ({ added: [], removed: [] }));
}

export function computeCategoryConfigChanges(
  tree: CostCategoryNode[],
  versions: CategoryMappingVersion[],
  months: SeriesMonth[]
): CategoryConfigChanges {
  if (months.length === 0) return {};

  const rootOf = new Map<string, string>();
  const nameOf = new Map<string, string>();
  for (const root of tree) indexRoots(root, root.id, rootOf, nameOf);

  const versionsByCont = new Map<string, CategoryMappingVersion[]>();
  for (const v of versions) {
    const arr = versionsByCont.get(v.cont);
    if (arr) arr.push(v);
    else versionsByCont.set(v.cont, [v]);
  }

  const resolveRoot = (vs: CategoryMappingVersion[], key: number): string | null => {
    const picked = pickEffective(vs, key);
    if (!picked || picked.categoryId === null) return null;
    return rootOf.get(picked.categoryId) ?? null;
  };

  const result: CategoryConfigChanges = {};
  const ensure = (rootId: string): MonthConfigChange[] => {
    let arr = result[rootId];
    if (!arr) {
      arr = emptyMonths(months.length);
      result[rootId] = arr;
    }
    return arr;
  };

  const keys = months.map((m) => periodKey(m.year, m.month));
  const beforeFirst = previousPeriod(keys[0]);

  for (const [, vs] of versionsByCont) {
    let prevRoot = resolveRoot(vs, beforeFirst);
    for (let i = 0; i < keys.length; i++) {
      const curRoot = resolveRoot(vs, keys[i]);
      if (curRoot !== prevRoot) {
        const cont = vs[0].cont;
        if (prevRoot !== null) {
          ensure(prevRoot)[i].removed.push({
            cont,
            otherLabel: curRoot ? nameOf.get(curRoot) ?? curRoot : "nemapat",
          });
        }
        if (curRoot !== null) {
          ensure(curRoot)[i].added.push({
            cont,
            otherLabel: prevRoot ? nameOf.get(prevRoot) ?? prevRoot : "nemapat",
          });
        }
      }
      prevRoot = curRoot;
    }
  }

  return result;
}

function indexRoots(
  node: CostCategoryNode,
  rootId: string,
  rootOf: Map<string, string>,
  nameOf: Map<string, string>
): void {
  rootOf.set(node.id, rootId);
  if (!nameOf.has(rootId)) nameOf.set(rootId, "");
  // Root name is the root node's own name; set when we visit the root itself.
  if (node.id === rootId) nameOf.set(rootId, node.name);
  for (const child of node.children) indexRoots(child, rootId, rootOf, nameOf);
}
