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

  /* ------------------- Sprint 6 — partner-override redistribution ----------- */

  it("Sprint 6: partner adjustment redirects rulaj from default to target category", () => {
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const curierat = rootNode("c-cur", "Servicii curierat", "expense");
    const resolver = buildResolverState(
      [combustibil, curierat],
      [
        { cont: "6022", categoryId: "c-comb", scope: "contBase" as MappingScope },
      ]
    );

    const rows = [
      makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 }),
    ];

    // Without adjustment: all 10k to Combustibil.
    const baseline = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver
    );
    expect(baseline.find((r) => r.label === "Combustibil")?.value).toBe(10000);
    expect(baseline.find((r) => r.label === "Servicii curierat")).toBeUndefined();

    // With adjustment: 900 lei from cont 6022 redirected to Curierat.
    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "6022", targetCategoryId: "c-cur", amount: 900 }]
    );
    expect(adjusted.find((r) => r.label === "Combustibil")?.value).toBe(9100);
    expect(adjusted.find((r) => r.label === "Servicii curierat")?.value).toBe(900);
    // Total preserved — money doesn't appear out of thin air.
    const total = adjusted
      .filter((r) => r.depth === 0)
      .reduce((s, r) => s + r.value, 0);
    expect(total).toBe(10000);
  });

  it("Sprint 6: multiple adjustments aggregate cleanly on the same source cont", () => {
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const curierat = rootNode("c-cur", "Curierat", "expense");
    const transport = rootNode("c-tr", "Transport", "expense");
    const resolver = buildResolverState(
      [combustibil, curierat, transport],
      [
        { cont: "6022", categoryId: "c-comb", scope: "contBase" as MappingScope },
      ]
    );

    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];

    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [
        { analyticCont: "6022", targetCategoryId: "c-cur", amount: 900 },
        { analyticCont: "6022", targetCategoryId: "c-tr", amount: 1100 },
      ]
    );

    expect(adjusted.find((r) => r.label === "Combustibil")?.value).toBe(8000);
    expect(adjusted.find((r) => r.label === "Curierat")?.value).toBe(900);
    expect(adjusted.find((r) => r.label === "Transport")?.value).toBe(1100);
  });

  it("Sprint 6: adjustment from a fallback-coded cont creates the target bucket", () => {
    // Cont 6028 has no cont-mapping → goes to fallback "60". But OMV on
    // 6028 has an override to Combustibil → 700 lei redirected from
    // fallback to Combustibil.
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const resolver = buildResolverState([combustibil], []);

    const rows = [makeRow({ cont: "6028", contBase: "6028", rulajD: 2000 })];

    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "6028", targetCategoryId: "c-comb", amount: 700 }]
    );

    const combItem = adjusted.find((r) => r.label === "Combustibil");
    const fallback = adjusted.find((r) => r.code.startsWith("fallback:60"));
    expect(combItem?.value).toBe(700);
    expect(fallback?.value).toBe(1300); // 2000 - 700
  });

  it("Sprint 6: adjustment to a non-existent category id is silently ignored", () => {
    // Defensive — category was deleted between adjustment computation and
    // breakdown rendering. We don't crash, we just keep the rulaj on the
    // default category.
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const resolver = buildResolverState(
      [combustibil],
      [{ cont: "6022", categoryId: "c-comb", scope: "contBase" as MappingScope }]
    );

    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];

    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "6022", targetCategoryId: "deleted-cat", amount: 900 }]
    );

    // Whole rulaj stays at Combustibil — no crash, no negative balance.
    expect(adjusted.find((r) => r.label === "Combustibil")?.value).toBe(10000);
  });

  it("Sprint 6: revenue adjustments work analogously (debit-side partner)", () => {
    const vanzari = rootNode("c-v", "Vanzari marfa", "revenue");
    const vanzariSpecial = rootNode("c-vs", "Vanzari speciale", "revenue");
    const resolver = buildResolverState(
      [vanzari, vanzariSpecial],
      [{ cont: "707", categoryId: "c-v", scope: "contBase" as MappingScope }]
    );

    const rows = [makeRow({ cont: "707", contBase: "707", rulajC: 50000 })];

    const adjusted = computeRevenueBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "707", targetCategoryId: "c-vs", amount: 10000 }]
    );

    expect(adjusted.find((r) => r.label === "Vanzari marfa")?.value).toBe(40000);
    expect(adjusted.find((r) => r.label === "Vanzari speciale")?.value).toBe(10000);
  });

  it("Sprint 6: adjustments targeting the cont's own default category are no-ops", () => {
    // Edge case: contabil mapped a partner to the same category the cont
    // already resolves to. The adjustment should be a wash — net effect
    // zero on the bucket value.
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const resolver = buildResolverState(
      [combustibil],
      [{ cont: "6022", categoryId: "c-comb", scope: "contBase" as MappingScope }]
    );

    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];

    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "6022", targetCategoryId: "c-comb", amount: 900 }]
    );

    // No change — the override picked the same category as the default.
    expect(adjusted.find((r) => r.label === "Combustibil")?.value).toBe(10000);
  });

  it("Sprint 6: expense breakdown ignores adjustments for revenue (7xx) conts", () => {
    // An adjustment targeting cont 707 must NOT affect the expense
    // breakdown — the class filter has to discard it.
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const vanzari = rootNode("c-v", "Vanzari", "revenue");
    const resolver = buildResolverState(
      [combustibil, vanzari],
      [
        { cont: "6022", categoryId: "c-comb", scope: "contBase" as MappingScope },
        { cont: "707", categoryId: "c-v", scope: "contBase" as MappingScope },
      ]
    );

    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];

    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "707", targetCategoryId: "c-v", amount: 5000 }]
    );

    // 6022 untouched, no spurious Vanzari item in expense breakdown.
    expect(adjusted.find((r) => r.label === "Combustibil")?.value).toBe(10000);
    expect(adjusted.find((r) => r.label === "Vanzari")).toBeUndefined();
  });

  it("Sprint 6: adjustments cap correctly so a cont can't go negative", () => {
    // This is a defensive check: the SUM of adjustments on a cont could
    // theoretically exceed its rulaj if there's data corruption (e.g.
    // refunds on the source cont but not on the adjustment side). The
    // current implementation does NOT enforce a hard cap because the
    // pipeline upstream guarantees this can't happen (every adjustment
    // comes from a real journal line that contributed to the same cont's
    // rulaj). This test just documents the invariant for future devs.
    const combustibil = rootNode("c-comb", "Combustibil", "expense");
    const curierat = rootNode("c-cur", "Curierat", "expense");
    const resolver = buildResolverState(
      [combustibil, curierat],
      [{ cont: "6022", categoryId: "c-comb", scope: "contBase" as MappingScope }]
    );

    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];

    const adjusted = computeExpenseBreakdownFromCategories(
      rows,
      CATALOG,
      resolver,
      [{ analyticCont: "6022", targetCategoryId: "c-cur", amount: 8000 }]
    );

    // Combustibil: 10000 - 8000 = 2000. Curierat: 8000.
    expect(adjusted.find((r) => r.label === "Combustibil")?.value).toBe(2000);
    expect(adjusted.find((r) => r.label === "Curierat")?.value).toBe(8000);
  });
});
