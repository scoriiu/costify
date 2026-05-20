import { describe, it, expect } from "vitest";
import {
  computeExpenseBreakdownFromCategories,
  computeRevenueBreakdownFromCategories,
} from "@/modules/reporting/owner";
import {
  buildResolverState,
  type CostCategoryNode,
  type MappingScope,
} from "@/modules/categories";
import { loadCatalogSync } from "@/modules/accounts";
import { makeBalanceRow as makeRow } from "../../../fixtures/balance-rows";

const CATALOG = loadCatalogSync();

function rootNode(
  id: string,
  name: string,
  kind: "expense" | "revenue"
): CostCategoryNode {
  return {
    id,
    clientId: "c1",
    parentId: null,
    name,
    kind,
    position: 0,
    isOmfpDefault: false,
    children: [],
    mappingCount: 0,
  };
}

function childNode(
  id: string,
  parentId: string,
  name: string,
  kind: "expense" | "revenue"
): CostCategoryNode {
  return {
    id,
    clientId: "c1",
    parentId,
    name,
    kind,
    position: 0,
    isOmfpDefault: false,
    children: [],
    mappingCount: 0,
  };
}

describe("computeExpenseBreakdownFromCategories", () => {
  it("rolls up to ROOT and surfaces sub-categories indented under it", () => {
    const salarii = rootNode("c-sal", "Salarii echipa", "expense");
    const salariiBrut = childNode("c-sal-brut", "c-sal", "Brut", "expense");
    const salariiContrib = childNode("c-sal-c", "c-sal", "Contributii", "expense");
    salarii.children = [salariiBrut, salariiContrib];

    const tree: CostCategoryNode[] = [salarii];
    const mappings = [
      { cont: "641", categoryId: "c-sal-brut", scope: "contBase" as MappingScope },
      { cont: "645", categoryId: "c-sal-c", scope: "contBase" as MappingScope },
    ];
    const resolver = buildResolverState(tree, mappings);

    const rows = [
      makeRow({ cont: "641.A", contBase: "641", rulajD: 40000 }),
      makeRow({ cont: "645.A", contBase: "645", rulajD: 10000 }),
    ];

    const result = computeExpenseBreakdownFromCategories(rows, CATALOG, resolver);
    // 1 root (Salarii echipa) + 2 leaves (Brut, Contributii) all surfaced.
    expect(result).toHaveLength(3);
    const root = result.find((i) => i.label === "Salarii echipa");
    const brut = result.find((i) => i.label === "Brut");
    const contrib = result.find((i) => i.label === "Contributii");
    expect(root?.value).toBe(50000);
    expect(root?.depth).toBe(0);
    expect(root?.percent).toBe(100);
    expect(brut?.value).toBe(40000);
    expect(brut?.depth).toBe(1);
    expect(contrib?.value).toBe(10000);
    expect(contrib?.depth).toBe(1);
  });

  it("falls back to OMFP 2-digit when an account has no mapping", () => {
    const salarii = rootNode("c-sal", "Salarii", "expense");
    const resolver = buildResolverState(
      [salarii],
      [{ cont: "64", categoryId: "c-sal", scope: "contBase" as MappingScope }]
    );

    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 30000 }),
      makeRow({ cont: "605", contBase: "605", rulajD: 8000 }),
    ];

    const result = computeExpenseBreakdownFromCategories(rows, CATALOG, resolver);
    expect(result).toHaveLength(2);
    const salariiItem = result.find((r) => r.label === "Salarii");
    const fallback = result.find((r) => r.code.startsWith("fallback:60"));
    expect(salariiItem?.value).toBe(30000);
    expect(fallback?.value).toBe(8000);
  });

  it("ignores revenue accounts when building expense breakdown", () => {
    const resolver = buildResolverState([], []);
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 10000 }),
      makeRow({ cont: "704", contBase: "704", rulajC: 99999 }),
    ];
    const result = computeExpenseBreakdownFromCategories(rows, CATALOG, resolver);
    expect(result.every((r) => r.label !== "Vanzari (cifra de afaceri)")).toBe(true);
  });

  it("709 contra-revenue subtracts from revenue breakdown", () => {
    const vanzari = rootNode("c-v", "Vanzari", "revenue");
    const resolver = buildResolverState(
      [vanzari],
      [{ cont: "70", categoryId: "c-v", scope: "contBase" as MappingScope }]
    );

    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajC: 100000 }),
      makeRow({ cont: "709", contBase: "709", rulajD: 15000 }),
    ];

    const result = computeRevenueBreakdownFromCategories(rows, CATALOG, resolver);
    const vItem = result.find((r) => r.label === "Vanzari");
    expect(vItem?.value).toBe(85000);
  });

  it("returns empty array when no rows produce amounts", () => {
    const resolver = buildResolverState([], []);
    expect(computeExpenseBreakdownFromCategories([], CATALOG, resolver)).toEqual([]);
  });
});
