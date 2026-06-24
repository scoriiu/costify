import { describe, it, expect } from "vitest";
import {
  INCEPTION,
  periodKey,
  periodYear,
  periodMonth,
  ytdPeriods,
  previousPeriod,
  pickAsOf,
  pickEffective,
  scopeToWindow,
  windowContains,
} from "@/lib/period";

describe("periodKey", () => {
  it("encodes year and month as YYYYMM", () => {
    expect(periodKey(2026, 4)).toBe(202604);
    expect(periodKey(2026, 12)).toBe(202612);
    expect(periodKey(2026, 1)).toBe(202601);
  });

  it("is monotonic across year boundaries", () => {
    expect(periodKey(2026, 12)).toBeLessThan(periodKey(2027, 1));
  });

  it("decodes back to year and month", () => {
    expect(periodYear(202604)).toBe(2026);
    expect(periodMonth(202604)).toBe(4);
    expect(periodMonth(202612)).toBe(12);
  });
});

describe("ytdPeriods", () => {
  it("returns Jan..month oldest first", () => {
    expect(ytdPeriods(2026, 4)).toEqual([202601, 202602, 202603, 202604]);
  });

  it("returns a single month for January", () => {
    expect(ytdPeriods(2026, 1)).toEqual([202601]);
  });

  it("covers the full year for December", () => {
    expect(ytdPeriods(2026, 12)).toHaveLength(12);
  });
});

describe("previousPeriod", () => {
  it("steps back within a year", () => {
    expect(previousPeriod(202604)).toBe(202603);
  });

  it("crosses the year boundary", () => {
    expect(previousPeriod(202601)).toBe(202512);
  });
});

describe("pickAsOf", () => {
  type V = { effectiveFrom: number; tag: string };
  const versions: V[] = [
    { effectiveFrom: INCEPTION, tag: "inception" },
    { effectiveFrom: 202604, tag: "april" },
    { effectiveFrom: 202609, tag: "september" },
  ];

  it("picks the inception version for periods before any dated version", () => {
    expect(pickAsOf(versions, 202601)?.tag).toBe("inception");
    expect(pickAsOf(versions, 202603)?.tag).toBe("inception");
  });

  it("picks the dated version from its effective month onward", () => {
    expect(pickAsOf(versions, 202604)?.tag).toBe("april");
    expect(pickAsOf(versions, 202608)?.tag).toBe("april");
  });

  it("picks the latest version that is still effective", () => {
    expect(pickAsOf(versions, 202609)?.tag).toBe("september");
    expect(pickAsOf(versions, 202712)?.tag).toBe("september");
  });

  it("returns null when every version starts after the target", () => {
    const future: V[] = [{ effectiveFrom: 202700, tag: "future" }];
    expect(pickAsOf(future, 202601)).toBeNull();
  });

  it("returns null for an empty version list", () => {
    expect(pickAsOf([], 202604)).toBeNull();
  });

  it("is order-independent", () => {
    const shuffled: V[] = [versions[2], versions[0], versions[1]];
    expect(pickAsOf(shuffled, 202605)?.tag).toBe("april");
  });

  it("treats a tombstone version like any other version (caller interprets it)", () => {
    const withTombstone = [
      { effectiveFrom: INCEPTION, categoryId: "cat-a" as string | null },
      { effectiveFrom: 202604, categoryId: null as string | null },
    ];
    expect(pickAsOf(withTombstone, 202603)?.categoryId).toBe("cat-a");
    expect(pickAsOf(withTombstone, 202604)?.categoryId).toBeNull();
  });
});

describe("scopeToWindow", () => {
  it("defaults to inception (all periods)", () => {
    expect(scopeToWindow()).toEqual({ effectiveFrom: INCEPTION, effectiveTo: null });
    expect(scopeToWindow({ kind: "all" })).toEqual({ effectiveFrom: INCEPTION, effectiveTo: null });
  });
  it("'from' is an open version starting at the month", () => {
    expect(scopeToWindow({ kind: "from", from: 202604 })).toEqual({
      effectiveFrom: 202604,
      effectiveTo: null,
    });
  });
  it("'only' is a bounded window", () => {
    expect(scopeToWindow({ kind: "only", from: 202604, to: 202606 })).toEqual({
      effectiveFrom: 202604,
      effectiveTo: 202606,
    });
  });
  it("rejects an inverted window and missing bounds", () => {
    expect(() => scopeToWindow({ kind: "only", from: 202606, to: 202604 })).toThrow();
    expect(() => scopeToWindow({ kind: "from" })).toThrow();
    expect(() => scopeToWindow({ kind: "only", from: 202604 })).toThrow();
  });
});

describe("windowContains", () => {
  it("is false for open versions", () => {
    expect(windowContains({ effectiveFrom: 0, effectiveTo: null }, 202604)).toBe(false);
  });
  it("is inclusive on both ends", () => {
    const w = { effectiveFrom: 202604, effectiveTo: 202606 };
    expect(windowContains(w, 202603)).toBe(false);
    expect(windowContains(w, 202604)).toBe(true);
    expect(windowContains(w, 202606)).toBe(true);
    expect(windowContains(w, 202607)).toBe(false);
  });
});

describe("pickEffective — two-layer (bounded override, then open)", () => {
  type V = { effectiveFrom: number; effectiveTo: number | null; tag: string };
  const open: V[] = [
    { effectiveFrom: INCEPTION, effectiveTo: null, tag: "base" },
    { effectiveFrom: 202603, effectiveTo: null, tag: "from-mar" },
  ];

  it("falls back to the open layer when no bounded override covers the period", () => {
    expect(pickEffective(open, 202602)?.tag).toBe("base");
    expect(pickEffective(open, 202604)?.tag).toBe("from-mar");
  });

  it("a bounded override wins inside its window", () => {
    const vs: V[] = [...open, { effectiveFrom: 202604, effectiveTo: 202605, tag: "pin" }];
    expect(pickEffective(vs, 202603)?.tag).toBe("from-mar");
    expect(pickEffective(vs, 202604)?.tag).toBe("pin");
    expect(pickEffective(vs, 202605)?.tag).toBe("pin");
    expect(pickEffective(vs, 202606)?.tag).toBe("from-mar");
  });

  it("returns null when nothing covers the period", () => {
    expect(pickEffective([{ effectiveFrom: 202609, effectiveTo: null, tag: "future" }], 202601)).toBeNull();
  });

  it("is order-independent", () => {
    const vs: V[] = [
      { effectiveFrom: 202604, effectiveTo: 202605, tag: "pin" },
      { effectiveFrom: INCEPTION, effectiveTo: null, tag: "base" },
    ];
    const shuffled = [vs[1], vs[0]];
    expect(pickEffective(shuffled, 202604)?.tag).toBe("pin");
    expect(pickEffective(shuffled, 202607)?.tag).toBe("base");
  });
});
