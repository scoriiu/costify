import { describe, it, expect } from "vitest";
import {
  buildVerticalResolverAsOf,
  resolveAllocationForCont,
  type AllocationVersion,
  type CategoryAllocationVersion,
  type FirmDefaultVersion,
} from "@/modules/verticals";
import { periodKey, INCEPTION } from "@/lib/period";
import type { AllocationSplit } from "@/modules/verticals";

const A = "vert-a";
const B = "vert-b";
const DEFAULT = "vert-default";

function va(
  cont: string,
  splits: AllocationSplit[],
  effectiveFrom: number,
  effectiveTo: number | null = null
): AllocationVersion {
  return { cont, scope: "contBase", splits, effectiveFrom, effectiveTo };
}
function vc(
  categoryId: string,
  splits: AllocationSplit[],
  effectiveFrom: number,
  effectiveTo: number | null = null
): CategoryAllocationVersion {
  return { categoryId, splits, effectiveFrom, effectiveTo };
}
function vf(
  splits: AllocationSplit[],
  effectiveFrom: number,
  effectiveTo: number | null = null
): FirmDefaultVersion {
  return { splits, effectiveFrom, effectiveTo };
}

describe("buildVerticalResolverAsOf — open timeline", () => {
  it("inception cont allocation applies to every period", () => {
    const allocs = [va("605", [{ verticalId: A, percent: 100 }], INCEPTION)];
    const state = buildVerticalResolverAsOf(allocs, DEFAULT, [], [], periodKey(2026, 7));
    const res = resolveAllocationForCont("605", state);
    expect(res.splits).toEqual([{ verticalId: A, percent: 100 }]);
    expect(res.matchedScope).toBe("contBase");
  });

  it("switches the split from the effective month onward", () => {
    const allocs = [
      va("605", [{ verticalId: A, percent: 100 }], INCEPTION),
      va("605", [{ verticalId: A, percent: 60 }, { verticalId: B, percent: 40 }], periodKey(2026, 5)),
    ];
    const april = buildVerticalResolverAsOf(allocs, DEFAULT, [], [], periodKey(2026, 4));
    const may = buildVerticalResolverAsOf(allocs, DEFAULT, [], [], periodKey(2026, 5));
    expect(resolveAllocationForCont("605", april).splits).toEqual([{ verticalId: A, percent: 100 }]);
    expect(resolveAllocationForCont("605", may).splits).toEqual([
      { verticalId: A, percent: 60 },
      { verticalId: B, percent: 40 },
    ]);
  });

  it("an open tombstone (empty splits) falls through to firm default", () => {
    const allocs = [
      va("605", [{ verticalId: A, percent: 100 }], INCEPTION),
      va("605", [], periodKey(2026, 6)),
    ];
    const firm = [vf([{ verticalId: B, percent: 100 }], INCEPTION)];
    const may = buildVerticalResolverAsOf(allocs, DEFAULT, [], firm, periodKey(2026, 5));
    const june = buildVerticalResolverAsOf(allocs, DEFAULT, [], firm, periodKey(2026, 6));
    expect(resolveAllocationForCont("605", may).matchedScope).toBe("contBase");
    const j = resolveAllocationForCont("605", june);
    expect(j.matchedScope).toBe("firm");
    expect(j.splits).toEqual([{ verticalId: B, percent: 100 }]);
  });

  it("firm default is itself period-scoped", () => {
    const firm = [
      vf([{ verticalId: A, percent: 100 }], INCEPTION),
      vf([{ verticalId: B, percent: 100 }], periodKey(2026, 3)),
    ];
    const feb = buildVerticalResolverAsOf([], DEFAULT, [], firm, periodKey(2026, 2));
    const mar = buildVerticalResolverAsOf([], DEFAULT, [], firm, periodKey(2026, 3));
    expect(resolveAllocationForCont("999", feb).splits).toEqual([{ verticalId: A, percent: 100 }]);
    expect(resolveAllocationForCont("999", mar).splits).toEqual([{ verticalId: B, percent: 100 }]);
  });

  it("category-level allocation is period-scoped and inherited via category path", () => {
    const catAllocs = [
      vc("cat-x", [{ verticalId: A, percent: 100 }], INCEPTION),
      vc("cat-x", [{ verticalId: B, percent: 100 }], periodKey(2026, 4)),
    ];
    const march = buildVerticalResolverAsOf([], DEFAULT, catAllocs, [], periodKey(2026, 3));
    const april = buildVerticalResolverAsOf([], DEFAULT, catAllocs, [], periodKey(2026, 4));
    expect(resolveAllocationForCont("605", march, ["cat-x"]).splits).toEqual([{ verticalId: A, percent: 100 }]);
    expect(resolveAllocationForCont("605", april, ["cat-x"]).splits).toEqual([{ verticalId: B, percent: 100 }]);
  });

  it("falls back to default vertical at 100% when nothing matches", () => {
    const state = buildVerticalResolverAsOf([], DEFAULT, [], [], periodKey(2026, 5));
    const res = resolveAllocationForCont("605", state);
    expect(res.splits).toEqual([{ verticalId: DEFAULT, percent: 100 }]);
    expect(res.matchedScope).toBe("default");
  });
});

describe("buildVerticalResolverAsOf — bounded overrides (D3 two-layer)", () => {
  it("a bounded cont override wins only inside its window", () => {
    const allocs = [
      va("605", [{ verticalId: A, percent: 100 }], INCEPTION),
      va("605", [{ verticalId: B, percent: 100 }], periodKey(2026, 4), periodKey(2026, 5)),
    ];
    const splitAt = (y: number, m: number) =>
      resolveAllocationForCont("605", buildVerticalResolverAsOf(allocs, DEFAULT, [], [], periodKey(y, m))).splits;
    expect(splitAt(2026, 3)).toEqual([{ verticalId: A, percent: 100 }]);
    expect(splitAt(2026, 4)).toEqual([{ verticalId: B, percent: 100 }]);
    expect(splitAt(2026, 5)).toEqual([{ verticalId: B, percent: 100 }]);
    expect(splitAt(2026, 6)).toEqual([{ verticalId: A, percent: 100 }]);
  });

  it("a bounded firm-default override applies only in its window", () => {
    const firm = [
      vf([{ verticalId: A, percent: 100 }], INCEPTION),
      vf([{ verticalId: B, percent: 100 }], periodKey(2026, 7), periodKey(2026, 7)),
    ];
    const splitAt = (y: number, m: number) =>
      resolveAllocationForCont("999", buildVerticalResolverAsOf([], DEFAULT, [], firm, periodKey(y, m))).splits;
    expect(splitAt(2026, 6)).toEqual([{ verticalId: A, percent: 100 }]);
    expect(splitAt(2026, 7)).toEqual([{ verticalId: B, percent: 100 }]);
    expect(splitAt(2026, 8)).toEqual([{ verticalId: A, percent: 100 }]);
  });
});
