import { describe, it, expect } from "vitest";
import { computeVerticalBreakdown } from "@/modules/reporting/owner";
import {
  buildVerticalResolver,
  type AllocationView,
  type AllocationScope,
} from "@/modules/verticals";
import { loadCatalogSync } from "@/modules/accounts";
import { makeBalanceRow as makeRow } from "../../../fixtures/balance-rows";

const CATALOG = loadCatalogSync();

function alloc(
  cont: string,
  scope: AllocationScope,
  splits: Array<{ verticalId: string; percent: number }>
): AllocationView {
  return { id: `a-${cont}`, clientId: "c1", scope, cont, splits };
}

const VERTICALS = [
  { id: "v-default", name: "Toata firma", isDefault: true },
  { id: "v-out", name: "Outsourcing", isDefault: false },
  { id: "v-cow", name: "Coworking", isDefault: false },
];

describe("computeVerticalBreakdown", () => {
  it("falls everything to default when no allocations", () => {
    const resolver = buildVerticalResolver([], "v-default");
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 50000 }),
      makeRow({ cont: "704", contBase: "704", rulajC: 100000 }),
    ];
    const result = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);
    const def = result.find((r) => r.verticalId === "v-default")!;
    expect(def.expenses).toBe(50000);
    expect(def.revenue).toBe(100000);
    expect(def.profit).toBe(50000);
  });

  it("applies a 60/40 split to one cont", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("605", "contBase", [
          { verticalId: "v-out", percent: 60 },
          { verticalId: "v-cow", percent: 40 },
        ]),
      ],
      "v-default"
    );
    const rows = [makeRow({ cont: "605", contBase: "605", rulajD: 10000 })];
    const result = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);

    expect(result.find((r) => r.verticalId === "v-out")?.expenses).toBe(6000);
    expect(result.find((r) => r.verticalId === "v-cow")?.expenses).toBe(4000);
    expect(result.find((r) => r.verticalId === "v-default")?.expenses).toBe(0);
  });

  it("totals reconcile when multiple accounts hit different verticals", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("641", "contBase", [{ verticalId: "v-out", percent: 100 }]),
        alloc("605", "contBase", [{ verticalId: "v-cow", percent: 100 }]),
      ],
      "v-default"
    );
    const rows = [
      makeRow({ cont: "641", contBase: "641", rulajD: 30000 }),
      makeRow({ cont: "605", contBase: "605", rulajD: 5000 }),
      makeRow({ cont: "611", contBase: "611", rulajD: 2000 }), // falls to default
    ];
    const result = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);
    const total = result.reduce((s, r) => s + r.expenses, 0);
    expect(total).toBe(37000);
    expect(result.find((r) => r.verticalId === "v-out")?.expenses).toBe(30000);
    expect(result.find((r) => r.verticalId === "v-cow")?.expenses).toBe(5000);
    expect(result.find((r) => r.verticalId === "v-default")?.expenses).toBe(2000);
  });

  it("computes profit = revenue - expenses per vertical", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("704", "contBase", [{ verticalId: "v-out", percent: 100 }]),
        alloc("641", "contBase", [{ verticalId: "v-out", percent: 100 }]),
      ],
      "v-default"
    );
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajC: 100000 }),
      makeRow({ cont: "641", contBase: "641", rulajD: 30000 }),
    ];
    const result = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);
    const out = result.find((r) => r.verticalId === "v-out")!;
    expect(out.revenue).toBe(100000);
    expect(out.expenses).toBe(30000);
    expect(out.profit).toBe(70000);
  });

  it("709 contra-revenue subtracts from vertical revenue", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("704", "contBase", [{ verticalId: "v-out", percent: 100 }]),
        alloc("709", "contBase", [{ verticalId: "v-out", percent: 100 }]),
      ],
      "v-default"
    );
    const rows = [
      makeRow({ cont: "704", contBase: "704", rulajC: 100000 }),
      makeRow({ cont: "709", contBase: "709", rulajD: 20000 }),
    ];
    const result = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);
    expect(result.find((r) => r.verticalId === "v-out")?.revenue).toBe(80000);
  });

  it("excludes 71/72 production accounts from revenue", () => {
    const resolver = buildVerticalResolver([], "v-default");
    const rows = [
      makeRow({ cont: "711", contBase: "711", rulajC: 50000 }),
      makeRow({ cont: "704", contBase: "704", rulajC: 30000 }),
    ];
    const result = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);
    expect(result.find((r) => r.verticalId === "v-default")?.revenue).toBe(
      30000
    );
  });
});
