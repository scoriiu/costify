/**
 * Helpers for flattening a CostCategory tree into a select-friendly list and
 * for finding descendants/ancestors.
 *
 * Pure functions; safe to use in both server and client components.
 */

import type { CostCategoryNode } from "@/modules/categories";

export interface FlatNode {
  id: string;
  name: string;
  /** Depth from the root: 0 = root, 1 = child, etc. */
  depth: number;
  kind: "expense" | "revenue";
  parentId: string | null;
  mappingCount: number;
  isOmfpDefault: boolean;
}

/**
 * Flatten the tree in DFS order so a <Select> can render it with indented
 * labels. Categories are filtered by `kind` so an expense account picker
 * never shows revenue branches and vice-versa.
 */
export function flattenTreeForPicker(
  tree: CostCategoryNode[],
  kind: "expense" | "revenue"
): FlatNode[] {
  const out: FlatNode[] = [];

  function walk(node: CostCategoryNode, depth: number) {
    if (node.kind !== kind) return;
    out.push({
      id: node.id,
      name: node.name,
      depth,
      kind: node.kind,
      parentId: node.parentId,
      mappingCount: node.mappingCount,
      isOmfpDefault: node.isOmfpDefault,
    });
    for (const child of node.children) walk(child, depth + 1);
  }

  for (const root of tree) walk(root, 0);
  return out;
}

/** Build the select <Option> label with indentation reflecting depth. */
export function pickerLabel(node: FlatNode): string {
  const prefix = node.depth === 0 ? "" : "  ".repeat(node.depth) + "› ";
  return prefix + node.name;
}

/**
 * Returns the path from root to the node (inclusive), used for breadcrumbs.
 * Returns empty array when the node is not found.
 */
export function pathToNode(
  tree: CostCategoryNode[],
  nodeId: string
): CostCategoryNode[] {
  for (const root of tree) {
    const path = searchPath(root, nodeId, []);
    if (path) return path;
  }
  return [];
}

function searchPath(
  node: CostCategoryNode,
  targetId: string,
  trail: CostCategoryNode[]
): CostCategoryNode[] | null {
  const nextTrail = [...trail, node];
  if (node.id === targetId) return nextTrail;
  for (const child of node.children) {
    const found = searchPath(child, targetId, nextTrail);
    if (found) return found;
  }
  return null;
}
