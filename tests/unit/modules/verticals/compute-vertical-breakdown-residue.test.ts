/**
 * Residue rule on axa B — what happens to vertical splits when a partner
 * override redirects rulaj from a cont's default category to another.
 *
 * The promise the docs make: numbers reconcile on BOTH axes. If 32.500 lei
 * land on cont 6022 and 900 of them get redirected via SC Logistic to
 * "Servicii curierat", then axa B must show 31.600 distributed by the cont's
 * horizontal + 900 routed by the target category's allocation. Total: 32.500
 * on axa B exactly, same as axa A.
 *
 * The Exemplul C from docs/ro/cashflow-limbajul-mapari.md (line 428) is the
 * reference: cont 6022, 32.500 lei, split 10/20/70 across Outsourcing /
 * Recruitment / Coworking; SC Logistic 900 lei → Servicii curierat.
 */

import { describe, it, expect } from "vitest";
import { computeVerticalBreakdown } from "@/modules/reporting/owner";
import {
  buildVerticalResolver,
  type AllocationView,
  type CategoryAllocationView,
  type AllocationScope,
} from "@/modules/verticals";
import type { PartnerCategoryAdjustment } from "@/modules/partner-mappings";
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

function categoryAlloc(
  categoryId: string,
  splits: Array<{ verticalId: string; percent: number }>
): CategoryAllocationView {
  return { id: `ca-${categoryId}`, clientId: "c1", categoryId, splits };
}

const VERTICALS = [
  { id: "v-default", name: "Toata firma", isDefault: true },
  { id: "v-out", name: "Outsourcing", isDefault: false },
  { id: "v-rec", name: "Recruitment", isDefault: false },
  { id: "v-cow", name: "Coworking", isDefault: false },
];

describe("computeVerticalBreakdown — residue from partner overrides", () => {
  it("with no adjustments behaves identically to today (regression guard)", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("6022", "contBase", [
          { verticalId: "v-out", percent: 10 },
          { verticalId: "v-rec", percent: 20 },
          { verticalId: "v-cow", percent: 70 },
        ]),
      ],
      "v-default"
    );
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 32500 })];
    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, []);
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(3250);
    expect(r.find((v) => v.verticalId === "v-rec")?.expenses).toBe(6500);
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(22750);
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(0);
  });

  it("subtracts adjustment from cont horizontal — sends slice to default vertical (Exemplul C, no category allocation)", () => {
    // Setup: cont 6022 with 32.500 lei, horizontal 10/20/70; SC Logistic
    // override 900 → Servicii curierat. Servicii curierat has no allocation
    // → residue goes to default vertical (Toata firma).
    const resolver = buildVerticalResolver(
      [
        alloc("6022", "contBase", [
          { verticalId: "v-out", percent: 10 },
          { verticalId: "v-rec", percent: 20 },
          { verticalId: "v-cow", percent: 70 },
        ]),
      ],
      "v-default"
    );
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 32500 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "6022", targetCategoryId: "cat-curierat", amount: 900 },
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    // Residue 31.600 split 10/20/70:
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(3160);
    expect(r.find((v) => v.verticalId === "v-rec")?.expenses).toBe(6320);
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(22120);
    // 900 lei to default vertical (no category allocation defined):
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(900);

    // Reconciliation: total expenses across all verticals MUST equal the
    // gross cont rulaj (32.500). This is the property the bug was breaking.
    const total = r.reduce((s, v) => s + v.expenses, 0);
    expect(total).toBe(32500);
  });

  it("uses target category's allocation when defined (Servicii curierat → 100% Outsourcing)", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("6022", "contBase", [
          { verticalId: "v-out", percent: 10 },
          { verticalId: "v-rec", percent: 20 },
          { verticalId: "v-cow", percent: 70 },
        ]),
      ],
      "v-default",
      [categoryAlloc("cat-curierat", [{ verticalId: "v-out", percent: 100 }])]
    );
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 32500 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "6022", targetCategoryId: "cat-curierat", amount: 900 },
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    // Residue 31.600 split 10/20/70:
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(3160 + 900); // residue slice + override slice
    expect(r.find((v) => v.verticalId === "v-rec")?.expenses).toBe(6320);
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(22120);
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(0);

    const total = r.reduce((s, v) => s + v.expenses, 0);
    expect(total).toBe(32500);
  });

  it("uses target category's split allocation 60/40", () => {
    const resolver = buildVerticalResolver(
      [
        alloc("6022", "contBase", [
          { verticalId: "v-cow", percent: 100 },
        ]),
      ],
      "v-default",
      [
        categoryAlloc("cat-curierat", [
          { verticalId: "v-out", percent: 60 },
          { verticalId: "v-rec", percent: 40 },
        ]),
      ]
    );
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "6022", targetCategoryId: "cat-curierat", amount: 1000 },
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    // Residue 9000 → 100% Coworking. Override 1000 → 60/40 Out/Rec.
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(9000);
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(600);
    expect(r.find((v) => v.verticalId === "v-rec")?.expenses).toBe(400);
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(0);

    const total = r.reduce((s, v) => s + v.expenses, 0);
    expect(total).toBe(10000);
  });

  it("handles multiple adjustments on the same cont (different target categories)", () => {
    const resolver = buildVerticalResolver(
      [alloc("6022", "contBase", [{ verticalId: "v-cow", percent: 100 }])],
      "v-default",
      [categoryAlloc("cat-A", [{ verticalId: "v-out", percent: 100 }])]
    );
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "6022", targetCategoryId: "cat-A", amount: 1000 },
      { analyticCont: "6022", targetCategoryId: "cat-B", amount: 500 }, // no allocation
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    // Residue 8500 → Cow; A 1000 → Out; B 500 → default.
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(8500);
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(1000);
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(500);

    const total = r.reduce((s, v) => s + v.expenses, 0);
    expect(total).toBe(10000);
  });

  it("handles adjustments larger than cont rulaj gracefully (residue can be negative)", () => {
    // Edge case: defensive — partner-aggregator may produce an adjustment that
    // exceeds the cont's balance-row rulaj if balance and journal disagree.
    // We do NOT silently drop; the residue goes negative on the cont and
    // positive on the target, and total still reconciles to adjustment amount.
    const resolver = buildVerticalResolver(
      [alloc("6022", "contBase", [{ verticalId: "v-cow", percent: 100 }])],
      "v-default"
    );
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 100 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "6022", targetCategoryId: "cat-X", amount: 1000 },
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    // Residue -900 → Cow. 1000 → default. Total = 100.
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(-900);
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(1000);
    const total = r.reduce((s, v) => s + v.expenses, 0);
    expect(total).toBe(100);
  });

  it("ignores adjustments for classes other than 6/7", () => {
    const resolver = buildVerticalResolver([], "v-default");
    const rows = [makeRow({ cont: "6022", contBase: "6022", rulajD: 10000 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "401", targetCategoryId: "cat-X", amount: 500 }, // class 4 — ignored
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(10000);
    expect(r.reduce((s, v) => s + v.expenses, 0)).toBe(10000);
  });

  it("applies revenue residue rule symmetrically (class 7)", () => {
    const resolver = buildVerticalResolver(
      [alloc("704", "contBase", [{ verticalId: "v-out", percent: 100 }])],
      "v-default",
      [categoryAlloc("cat-rev-X", [{ verticalId: "v-rec", percent: 100 }])]
    );
    const rows = [makeRow({ cont: "704", contBase: "704", rulajC: 100000 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "704", targetCategoryId: "cat-rev-X", amount: 20000 },
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    expect(r.find((v) => v.verticalId === "v-out")?.revenue).toBe(80000);
    expect(r.find((v) => v.verticalId === "v-rec")?.revenue).toBe(20000);
    const total = r.reduce((s, v) => s + v.revenue, 0);
    expect(total).toBe(100000);
  });

  it("a single cont with multiple partners overriding to different categories reconciles to gross", () => {
    // Real-world QHM21 case: cont 628 with 3 partners overridden to 3 distinct
    // categories. Residue stays on cont horizontal; each partner's slice goes
    // to its target category's allocation (or default).
    const resolver = buildVerticalResolver(
      [
        alloc("628", "contBase", [
          { verticalId: "v-out", percent: 50 },
          { verticalId: "v-cow", percent: 50 },
        ]),
      ],
      "v-default",
      [
        categoryAlloc("cat-A", [{ verticalId: "v-rec", percent: 100 }]),
        // cat-B has no allocation → default
        categoryAlloc("cat-C", [
          { verticalId: "v-out", percent: 50 },
          { verticalId: "v-rec", percent: 50 },
        ]),
      ]
    );
    const rows = [makeRow({ cont: "628", contBase: "628", rulajD: 10000 })];
    const adjustments: PartnerCategoryAdjustment[] = [
      { analyticCont: "628", targetCategoryId: "cat-A", amount: 1000 },
      { analyticCont: "628", targetCategoryId: "cat-B", amount: 2000 },
      { analyticCont: "628", targetCategoryId: "cat-C", amount: 3000 },
    ];

    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS, adjustments);

    // Residue 4000 → 50/50 Out/Cow = 2000 + 2000.
    // A 1000 → Rec.
    // B 2000 → default.
    // C 3000 → 50/50 Out/Rec = 1500 + 1500.
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(2000 + 1500);
    expect(r.find((v) => v.verticalId === "v-cow")?.expenses).toBe(2000);
    expect(r.find((v) => v.verticalId === "v-rec")?.expenses).toBe(1000 + 1500);
    expect(r.find((v) => v.verticalId === "v-default")?.expenses).toBe(2000);

    const total = r.reduce((s, v) => s + v.expenses, 0);
    expect(total).toBe(10000);
  });
});

describe("computeVerticalBreakdown — backward compatibility", () => {
  it("legacy signature without partnerAdjustments still works", () => {
    const resolver = buildVerticalResolver(
      [alloc("641", "contBase", [{ verticalId: "v-out", percent: 100 }])],
      "v-default"
    );
    const rows = [makeRow({ cont: "641", contBase: "641", rulajD: 30000 })];
    const r = computeVerticalBreakdown(rows, CATALOG, resolver, VERTICALS);
    expect(r.find((v) => v.verticalId === "v-out")?.expenses).toBe(30000);
  });

  it("legacy buildVerticalResolver call (without categoryAllocations) still works", () => {
    const resolver = buildVerticalResolver([], "v-default");
    // Just verify the new fields are initialized empty:
    expect(resolver.byCategoryId.size).toBe(0);
  });
});
