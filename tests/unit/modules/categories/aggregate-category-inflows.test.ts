import { describe, it, expect } from "vitest";
import {
  aggregateCategoryInflows,
  sumDefaultVerticalAbsorption,
} from "@/modules/categories/loader";
import type { PartnerCategoryAdjustment } from "@/modules/partner-mappings";

const adj = (
  analyticCont: string,
  targetCategoryId: string,
  amount: number
): PartnerCategoryAdjustment => ({ analyticCont, targetCategoryId, amount });

describe("aggregateCategoryInflows", () => {
  it("returns empty for empty input", () => {
    expect(aggregateCategoryInflows([])).toEqual({});
  });

  it("aggregates single adjustment into one category", () => {
    const r = aggregateCategoryInflows([adj("6022", "cat-X", 900)]);
    expect(r["cat-X"]).toEqual({
      amount: 900,
      sources: [{ cont: "6022", amount: 900 }],
    });
  });

  it("sums multiple adjustments to the same category from different conts", () => {
    const r = aggregateCategoryInflows([
      adj("6022", "cat-X", 900),
      adj("628", "cat-X", 1500),
    ]);
    expect(r["cat-X"].amount).toBe(2400);
    expect(r["cat-X"].sources).toHaveLength(2);
    // Sort desc by amount:
    expect(r["cat-X"].sources[0]).toEqual({ cont: "628", amount: 1500 });
    expect(r["cat-X"].sources[1]).toEqual({ cont: "6022", amount: 900 });
  });

  it("sums multiple adjustments from the same cont (different analytics rolled to same key)", () => {
    const r = aggregateCategoryInflows([
      adj("6022", "cat-X", 900),
      adj("6022", "cat-X", 300),
    ]);
    expect(r["cat-X"].amount).toBe(1200);
    expect(r["cat-X"].sources).toHaveLength(1);
    expect(r["cat-X"].sources[0]).toEqual({ cont: "6022", amount: 1200 });
  });

  it("splits across categories", () => {
    const r = aggregateCategoryInflows([
      adj("6022", "cat-A", 500),
      adj("6022", "cat-B", 800),
      adj("628", "cat-A", 200),
    ]);
    expect(Object.keys(r).sort()).toEqual(["cat-A", "cat-B"]);
    expect(r["cat-A"].amount).toBe(700);
    expect(r["cat-B"].amount).toBe(800);
    expect(r["cat-A"].sources).toEqual([
      { cont: "6022", amount: 500 },
      { cont: "628", amount: 200 },
    ]);
  });

  it("rounds to 2 decimals on sums", () => {
    const r = aggregateCategoryInflows([
      adj("6022", "cat-X", 100.005),
      adj("6022", "cat-X", 100.005),
    ]);
    // Each adj rounds first → exactly 100.01 + 100.01 = 200.02 (or close).
    // The important guarantee: result is rounded to 2 decimals.
    const cents = Math.round(r["cat-X"].amount * 100);
    expect(cents).toBe(r["cat-X"].amount * 100);
  });
});

describe("sumDefaultVerticalAbsorption", () => {
  it("returns 0 for empty adjustments", () => {
    expect(sumDefaultVerticalAbsorption([], new Set())).toBe(0);
  });

  it("sums all adjustments when no category has an allocation", () => {
    const r = sumDefaultVerticalAbsorption(
      [adj("6022", "cat-A", 500), adj("6022", "cat-B", 800)],
      new Set()
    );
    expect(r).toBe(1300);
  });

  it("excludes adjustments whose target category has an allocation", () => {
    const r = sumDefaultVerticalAbsorption(
      [adj("6022", "cat-A", 500), adj("6022", "cat-B", 800)],
      new Set(["cat-A"])
    );
    expect(r).toBe(800);
  });

  it("returns 0 when all targeted categories have allocations", () => {
    const r = sumDefaultVerticalAbsorption(
      [adj("6022", "cat-A", 500), adj("6022", "cat-B", 800)],
      new Set(["cat-A", "cat-B"])
    );
    expect(r).toBe(0);
  });

  it("rounds the sum to 2 decimals", () => {
    const r = sumDefaultVerticalAbsorption(
      [adj("6022", "cat-X", 100.555), adj("6022", "cat-Y", 200.444)],
      new Set()
    );
    expect(Math.round(r * 100)).toBe(r * 100);
  });
});
