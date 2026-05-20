import { describe, it, expect } from "vitest";
import {
  buildResolverState,
  resolveCategoryForCont,
  type CostCategoryNode,
  type MappingScope,
} from "@/modules/categories";

function node(
  id: string,
  name: string,
  kind: "expense" | "revenue" = "expense",
  parentId: string | null = null,
  children: CostCategoryNode[] = []
): CostCategoryNode {
  return {
    id,
    clientId: "client-1",
    parentId,
    name,
    kind,
    position: 0,
    isOmfpDefault: false,
    children,
    mappingCount: 0,
  };
}

describe("resolveCategoryForCont", () => {
  const salarii = node("cat-salarii", "Salarii si contributii");
  const servicii = node("cat-servicii", "Servicii externe");
  const outsourcingIT = node("cat-outsourcing", "Outsourcing IT", "expense", "cat-servicii");
  const tree: CostCategoryNode[] = [
    { ...salarii, children: [] },
    { ...servicii, children: [outsourcingIT] },
  ];

  it("returns null when no mapping exists", () => {
    const state = buildResolverState(tree, []);
    expect(resolveCategoryForCont("641", state)).toBe(null);
  });

  it("matches contBase mapping exactly", () => {
    const state = buildResolverState(tree, [
      { cont: "64", categoryId: "cat-salarii", scope: "contBase" as MappingScope },
    ]);
    const result = resolveCategoryForCont("641", state);
    expect(result?.category.id).toBe("cat-salarii");
    expect(result?.matchedScope).toBe("contBase");
  });

  it("analytic override beats contBase", () => {
    const state = buildResolverState(tree, [
      { cont: "628", categoryId: "cat-servicii", scope: "contBase" as MappingScope },
      { cont: "628.01", categoryId: "cat-outsourcing", scope: "analytic" as MappingScope },
    ]);
    const direct = resolveCategoryForCont("628.01", state);
    expect(direct?.category.id).toBe("cat-outsourcing");
    expect(direct?.matchedScope).toBe("analytic");

    const inherited = resolveCategoryForCont("628.02", state);
    expect(inherited?.category.id).toBe("cat-servicii");
    expect(inherited?.matchedScope).toBe("contBase");
  });

  it("walks shorter prefixes when base has no mapping", () => {
    const state = buildResolverState(tree, [
      { cont: "6", categoryId: "cat-salarii", scope: "contBase" as MappingScope },
    ]);
    expect(resolveCategoryForCont("641", state)?.category.id).toBe("cat-salarii");
  });

  it("builds the path from root to the matched node", () => {
    const state = buildResolverState(tree, [
      { cont: "628.01", categoryId: "cat-outsourcing", scope: "analytic" as MappingScope },
    ]);
    const result = resolveCategoryForCont("628.01", state);
    expect(result?.path.map((p) => p.id)).toEqual(["cat-servicii", "cat-outsourcing"]);
  });

  it("returns null for orphaned mapping (category deleted)", () => {
    const state = buildResolverState(tree, [
      { cont: "641", categoryId: "deleted-cat", scope: "contBase" as MappingScope },
    ]);
    expect(resolveCategoryForCont("641", state)).toBe(null);
  });
});
