import { describe, it, expect } from "vitest";
import {
  buildVerticalResolver,
  resolveAllocationForCategory,
  type CategoryAllocationView,
} from "@/modules/verticals";

function ca(
  categoryId: string,
  splits: Array<{ verticalId: string; percent: number }>
): CategoryAllocationView {
  return { id: `ca-${categoryId}`, clientId: "c1", categoryId, splits };
}

describe("resolveAllocationForCategory", () => {
  it("returns default vertical when no category allocation exists", () => {
    const state = buildVerticalResolver([], "v-default");
    const r = resolveAllocationForCategory("cat-X", state);
    expect(r.matchedScope).toBe("default");
    expect(r.splits).toEqual([{ verticalId: "v-default", percent: 100 }]);
  });

  it("returns the category's allocation when present", () => {
    const state = buildVerticalResolver(
      [],
      "v-default",
      [ca("cat-X", [{ verticalId: "v-out", percent: 60 }, { verticalId: "v-cow", percent: 40 }])]
    );
    const r = resolveAllocationForCategory("cat-X", state);
    expect(r.matchedScope).toBe("category");
    expect(r.splits).toEqual([
      { verticalId: "v-out", percent: 60 },
      { verticalId: "v-cow", percent: 40 },
    ]);
  });

  it("does not cross-pollute between categories", () => {
    const state = buildVerticalResolver(
      [],
      "v-default",
      [
        ca("cat-A", [{ verticalId: "v-out", percent: 100 }]),
        ca("cat-B", [{ verticalId: "v-cow", percent: 100 }]),
      ]
    );
    expect(resolveAllocationForCategory("cat-A", state).splits[0].verticalId).toBe("v-out");
    expect(resolveAllocationForCategory("cat-B", state).splits[0].verticalId).toBe("v-cow");
    expect(resolveAllocationForCategory("cat-C", state).matchedScope).toBe("default");
  });
});
