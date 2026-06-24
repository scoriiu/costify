import { describe, it, expect } from "vitest";
import { makeBalanceRow } from "@tests/fixtures/balance-rows";
import {
  buildResolverState,
  type CostCategoryNode,
} from "@/modules/categories";
import { computeCostLineSeries } from "@/modules/reporting/owner/line-series";
import type { CatalogAccount } from "@/modules/accounts";

function node(
  id: string,
  name: string,
  parentId: string | null,
  children: CostCategoryNode[] = []
): CostCategoryNode {
  return {
    id,
    clientId: "c1",
    parentId,
    name,
    kind: "expense",
    position: 0,
    isOmfpDefault: false,
    children,
    mappingCount: 0,
  };
}

const emptyCatalog = new Map<string, CatalogAccount>();

describe("computeCostLineSeries — depth-0 roll-up filter", () => {
  it("emits only the root line with the rolled-up total, not its children", () => {
    const chirie = node("chirie", "Chirie", "op");
    const op = node("op", "Operational", null, [chirie]);
    const resolver = buildResolverState([op], [
      { cont: "61", categoryId: "op", scope: "contBase" },
      { cont: "612", categoryId: "chirie", scope: "contBase" },
    ]);

    const rows = [
      makeBalanceRow({ cont: "611", contBase: "611", rulajD: 100 }), // -> op (prefix 61)
      makeBalanceRow({ cont: "612", contBase: "612", rulajD: 50 }), // -> chirie -> rolls to op
    ];

    const series = computeCostLineSeries({
      endYear: 2026,
      endMonth: 1,
      windowMonths: 1,
      catalog: emptyCatalog,
      kind: "expense",
      rowsFor: (y, m) => (y === 2026 && m === 1 ? rows : []),
      resolverFor: () => resolver,
    });

    expect(series.lines).toHaveLength(1);
    expect(series.lines[0]).toMatchObject({ id: "op", label: "Operational", total: 150 });
    expect(series.lines.some((l) => l.id === "chirie")).toBe(false);
  });

  it("produces a multi-month series for a single root line", () => {
    const op = node("op", "Operational", null, []);
    const resolver = buildResolverState([op], [
      { cont: "61", categoryId: "op", scope: "contBase" },
    ]);
    const rowsByMonth: Record<number, ReturnType<typeof makeBalanceRow>[]> = {
      1: [makeBalanceRow({ cont: "611", contBase: "611", rulajD: 100 })],
      2: [makeBalanceRow({ cont: "611", contBase: "611", rulajD: 200 })],
      3: [makeBalanceRow({ cont: "611", contBase: "611", rulajD: 0 })],
    };

    const series = computeCostLineSeries({
      endYear: 2026,
      endMonth: 3,
      windowMonths: 3,
      catalog: emptyCatalog,
      kind: "expense",
      rowsFor: (y, m) => (y === 2026 ? rowsByMonth[m] ?? [] : []),
      resolverFor: () => resolver,
    });

    expect(series.lines[0].values).toEqual([100, 200, 0]);
    expect(series.lines[0].total).toBe(300);
  });
});
