import { describe, it, expect } from "vitest";
import {
  buildVerticalResolver,
  resolveAllocationForCont,
  applySplit,
  type AllocationView,
  type AllocationScope,
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
