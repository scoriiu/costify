import { describe, it, expect } from "vitest";
import { inheritedSplitsForAccount } from "@/components/clients/mapari-cashflow/edit-allocation-dialog";
import type { AccountListItem } from "@/modules/categories";

function account(overrides: Partial<AccountListItem> = {}): AccountListItem {
  return {
    cont: "641",
    contBase: "641",
    denumire: "Cheltuieli cu salariile",
    kind: "expense",
    rulajD: 0,
    rulajC: 0,
    currentMapping: null,
    hasAnalyticOverride: false,
    currentAllocation: null,
    effectiveAllocation: { splits: [], source: "default" },
    hasAnalyticVerticalOverride: false,
    partnerCount: 0,
    partnerOverrideCount: 0,
    partnerOverriddenRulaj: 0,
    partnerLobOverrideCount: 0,
    ...overrides,
  };
}

describe("inheritedSplitsForAccount", () => {
  it("seeds the editor from the inherited category split when the cont has no own rule", () => {
    const split = [
      { verticalId: "v1", percent: 50 },
      { verticalId: "v2", percent: 50 },
    ];
    const result = inheritedSplitsForAccount(
      account({
        currentAllocation: null,
        effectiveAllocation: { splits: split, source: "category" },
      })
    );
    expect(result).toEqual(split);
  });

  it("seeds from the inherited firm split too", () => {
    const split = [{ verticalId: "v1", percent: 70 }, { verticalId: "v2", percent: 30 }];
    const result = inheritedSplitsForAccount(
      account({
        currentAllocation: null,
        effectiveAllocation: { splits: split, source: "firm" },
      })
    );
    expect(result).toEqual(split);
  });

  it("returns undefined when the cont has its OWN rule (let currentAllocation drive)", () => {
    const own = [{ verticalId: "v1", percent: 100 }];
    const result = inheritedSplitsForAccount(
      account({
        currentAllocation: { scope: "contBase", splits: own },
        effectiveAllocation: { splits: own, source: "own" },
      })
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined for the legacy default source (no meaningful split to seed)", () => {
    const result = inheritedSplitsForAccount(
      account({
        currentAllocation: null,
        effectiveAllocation: {
          splits: [{ verticalId: "default", percent: 100 }],
          source: "default",
        },
      })
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when the inherited split is empty", () => {
    const result = inheritedSplitsForAccount(
      account({
        currentAllocation: null,
        effectiveAllocation: { splits: [], source: "category" },
      })
    );
    expect(result).toBeUndefined();
  });
});
