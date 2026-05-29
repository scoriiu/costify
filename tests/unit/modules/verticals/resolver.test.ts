import { describe, it, expect } from "vitest";
import {
  buildVerticalResolver,
  resolveAllocationForCont,
  applySplit,
  type AllocationView,
  type AllocationScope,
  type CategoryAllocationView,
} from "@/modules/verticals";

const DEFAULT_V = "v-default";

function alloc(
  cont: string,
  scope: AllocationScope,
  splits: Array<{ verticalId: string; percent: number }>
): AllocationView {
  return { id: `a-${cont}`, clientId: "c1", scope, cont, splits };
}

describe("resolveAllocationForCont", () => {
  it("falls back to default when no allocation exists", () => {
    const state = buildVerticalResolver([], DEFAULT_V);
    const result = resolveAllocationForCont("641", state);
    expect(result.matchedScope).toBe("default");
    expect(result.splits).toEqual([{ verticalId: DEFAULT_V, percent: 100 }]);
  });

  it("matches contBase exactly", () => {
    const state = buildVerticalResolver(
      [alloc("64", "contBase", [{ verticalId: "v-out", percent: 100 }])],
      DEFAULT_V
    );
    const result = resolveAllocationForCont("641", state);
    expect(result.matchedScope).toBe("contBase");
    expect(result.splits[0].verticalId).toBe("v-out");
  });

  it("analytic beats contBase", () => {
    const state = buildVerticalResolver(
      [
        alloc("628", "contBase", [{ verticalId: "v-out", percent: 100 }]),
        alloc("628.01", "analytic", [{ verticalId: "v-rec", percent: 100 }]),
      ],
      DEFAULT_V
    );

    expect(resolveAllocationForCont("628.01", state).splits[0].verticalId).toBe(
      "v-rec"
    );
    expect(resolveAllocationForCont("628.02", state).splits[0].verticalId).toBe(
      "v-out"
    );
  });

  it("walks prefix down to 1 digit", () => {
    const state = buildVerticalResolver(
      [alloc("6", "contBase", [{ verticalId: "v-out", percent: 100 }])],
      DEFAULT_V
    );
    expect(resolveAllocationForCont("641", state).splits[0].verticalId).toBe(
      "v-out"
    );
  });

  it("returns multi-split unchanged", () => {
    const splits = [
      { verticalId: "v-out", percent: 60 },
      { verticalId: "v-cow", percent: 40 },
    ];
    const state = buildVerticalResolver(
      [alloc("605", "contBase", splits)],
      DEFAULT_V
    );
    expect(resolveAllocationForCont("605", state).splits).toEqual(splits);
  });
});

function catAlloc(
  categoryId: string,
  splits: Array<{ verticalId: string; percent: number }>
): CategoryAllocationView {
  return { id: `ca-${categoryId}`, clientId: "c1", categoryId, splits };
}

describe("resolveAllocationForCont — cascade (category → firm → default)", () => {
  const FIRM_SPLIT = [
    { verticalId: "v-out", percent: 40 },
    { verticalId: "v-rec", percent: 60 },
  ];
  const CAT_SPLIT = [
    { verticalId: "v-out", percent: 40 },
    { verticalId: "v-rec", percent: 60 },
  ];

  it("a cont with no own rule inherits its category split", () => {
    const state = buildVerticalResolver(
      [],
      DEFAULT_V,
      [catAlloc("cat-marfa", CAT_SPLIT)]
    );
    const result = resolveAllocationForCont("371", state, ["cat-marfa"]);
    expect(result.matchedScope).toBe("category");
    expect(result.splits).toEqual(CAT_SPLIT);
  });

  it("a split set on a parent category cascades to children (most-specific wins)", () => {
    const state = buildVerticalResolver(
      [],
      DEFAULT_V,
      [catAlloc("cat-top", CAT_SPLIT)]
    );
    // path is leaf -> ... -> top; only the top has a split
    const result = resolveAllocationForCont("371", state, ["cat-leaf", "cat-top"]);
    expect(result.matchedScope).toBe("category");
    expect(result.splits).toEqual(CAT_SPLIT);
  });

  it("a leaf split beats an ancestor split", () => {
    const leaf = [{ verticalId: "v-rec", percent: 100 }];
    const state = buildVerticalResolver(
      [],
      DEFAULT_V,
      [catAlloc("cat-leaf", leaf), catAlloc("cat-top", CAT_SPLIT)]
    );
    const result = resolveAllocationForCont("371", state, ["cat-leaf", "cat-top"]);
    expect(result.splits).toEqual(leaf);
  });

  it("a cont rule beats the category split", () => {
    const state = buildVerticalResolver(
      [alloc("371", "contBase", [{ verticalId: "v-out", percent: 100 }])],
      DEFAULT_V,
      [catAlloc("cat-marfa", CAT_SPLIT)]
    );
    const result = resolveAllocationForCont("371", state, ["cat-marfa"]);
    expect(result.matchedScope).toBe("contBase");
    expect(result.splits[0].verticalId).toBe("v-out");
  });

  it("falls through to firm-top default when no cont/category rule", () => {
    const state = buildVerticalResolver([], DEFAULT_V, [], FIRM_SPLIT);
    const result = resolveAllocationForCont("371", state, ["cat-unset"]);
    expect(result.matchedScope).toBe("firm");
    expect(result.splits).toEqual(FIRM_SPLIT);
  });

  it("category beats firm-top default", () => {
    const state = buildVerticalResolver(
      [],
      DEFAULT_V,
      [catAlloc("cat-marfa", CAT_SPLIT)],
      FIRM_SPLIT
    );
    const result = resolveAllocationForCont("371", state, ["cat-marfa"]);
    expect(result.matchedScope).toBe("category");
  });

  it("falls to legacy default when nothing is configured", () => {
    const state = buildVerticalResolver([], DEFAULT_V, [], null);
    const result = resolveAllocationForCont("371", state, ["cat-x"]);
    expect(result.matchedScope).toBe("default");
    expect(result.splits).toEqual([{ verticalId: DEFAULT_V, percent: 100 }]);
  });

  it("resolves the category split even when there is NO default vertical", () => {
    const state = buildVerticalResolver(
      [],
      null,
      [catAlloc("cat-marfa", CAT_SPLIT)]
    );
    const result = resolveAllocationForCont("603", state, ["cat-marfa"]);
    expect(result.matchedScope).toBe("category");
    expect(result.splits).toEqual(CAT_SPLIT);
  });

  it("returns an empty split (unallocated) when no default vertical and nothing matches", () => {
    const state = buildVerticalResolver([], null, [], null);
    const result = resolveAllocationForCont("371", state, ["cat-x"]);
    expect(result.matchedScope).toBe("default");
    expect(result.splits).toEqual([]);
  });
});

describe("applySplit", () => {
  it("splits monetary amount by percentages", () => {
    const result = applySplit(1000, [
      { verticalId: "a", percent: 60 },
      { verticalId: "b", percent: 40 },
    ]);
    expect(result).toEqual([
      { verticalId: "a", amount: 600 },
      { verticalId: "b", amount: 400 },
    ]);
  });

  it("last slice absorbs rounding so total matches input", () => {
    const result = applySplit(100, [
      { verticalId: "a", percent: 33 },
      { verticalId: "b", percent: 33 },
      { verticalId: "c", percent: 34 },
    ]);
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(100);
  });

  it("handles single split as identity", () => {
    const result = applySplit(5000, [{ verticalId: "x", percent: 100 }]);
    expect(result).toEqual([{ verticalId: "x", amount: 5000 }]);
  });

  it("returns empty array on empty splits", () => {
    expect(applySplit(1000, [])).toEqual([]);
  });

  it("handles negative amounts (contra-expense)", () => {
    const result = applySplit(-500, [
      { verticalId: "a", percent: 50 },
      { verticalId: "b", percent: 50 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(-500);
  });
});
