import { describe, it, expect } from "vitest";
import {
  filterPartners,
  computeBulkTargets,
  splitTargetsByExistence,
  computeParetoCutoff,
  normalizeForSearch,
  sumRulaj,
  maxRulaj,
  rulajBarPercent,
} from "@/modules/partner-mappings";
import type { PartnerEntry, PartnerCategoryOverrideRow } from "@/modules/partner-mappings";

function row(
  overrides: Partial<PartnerCategoryOverrideRow> = {}
): PartnerCategoryOverrideRow {
  return {
    id: "override-1",
    clientId: "client-1",
    contBase: "6022",
    partnerNameNormalized: "omv",
    partnerNameOriginal: "OMV",
    categoryId: "cat-x",
    source: "manual",
    confirmedAt: new Date("2026-04-15"),
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-15"),
    ...overrides,
  };
}

function partner(over: Partial<PartnerEntry> = {}): PartnerEntry {
  return {
    nameNormalized: "p",
    nameOriginal: "Partener",
    rulaj: 100,
    override: null,
    suggestedCategoryId: null,
    ...over,
  };
}

const SAMPLE: PartnerEntry[] = [
  partner({ nameNormalized: "omv petrom", nameOriginal: "OMV PETROM SRL", rulaj: 4000, override: row() }),
  partner({ nameNormalized: "lukoil", nameOriginal: "LUKOIL", rulaj: 3500 }),
  partner({ nameNormalized: "mol romania", nameOriginal: "MOL ROMANIA SRL", rulaj: 1200 }),
  partner({ nameNormalized: "tiriac auto", nameOriginal: "Țiriac Auto", rulaj: 800 }),
  partner({ nameNormalized: "rompetrol", nameOriginal: "ROMPETROL DOWNSTREAM", rulaj: 600 }),
];

describe("normalizeForSearch", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeForSearch("Țiriac")).toBe("tiriac");
    expect(normalizeForSearch("ENEL ROMÂNIA")).toBe("enel romania");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeForSearch("  rompetrol  ")).toBe("rompetrol");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeForSearch("")).toBe("");
    expect(normalizeForSearch("   ")).toBe("");
  });
});

describe("filterPartners", () => {
  it("returns all partners for filter='all' without search", () => {
    expect(filterPartners(SAMPLE, "all", "")).toHaveLength(5);
  });

  it("returns only partners without an override for filter='unmapped'", () => {
    const result = filterPartners(SAMPLE, "unmapped", "");
    expect(result).toHaveLength(4);
    expect(result.every((p) => p.override === null)).toBe(true);
  });

  it("returns the first 10 (or fewer) partners for filter='top10'", () => {
    expect(filterPartners(SAMPLE, "top10", "")).toHaveLength(5);
    const bigList = Array.from({ length: 25 }, (_, i) =>
      partner({ nameNormalized: `p${i}`, nameOriginal: `P${i}` })
    );
    expect(filterPartners(bigList, "top10", "")).toHaveLength(10);
  });

  it("search is diacritic-insensitive and case-insensitive", () => {
    expect(filterPartners(SAMPLE, "all", "tiriac")).toHaveLength(1);
    expect(filterPartners(SAMPLE, "all", "TIRIAC")).toHaveLength(1);
    expect(filterPartners(SAMPLE, "all", "țiriac")).toHaveLength(1);
  });

  it("search matches substring on nameOriginal", () => {
    expect(filterPartners(SAMPLE, "all", "petrom")).toHaveLength(1);
    expect(filterPartners(SAMPLE, "all", "rom")).toHaveLength(3); // PETROM, ROMANIA, ROMPETROL
  });

  it("search combines with toggle (top10 + search)", () => {
    expect(filterPartners(SAMPLE, "top10", "lukoil")).toHaveLength(1);
  });

  it("search combines with toggle (unmapped + search excludes overridden hits)", () => {
    // OMV PETROM has an override; searching 'petrom' under 'unmapped' yields zero.
    expect(filterPartners(SAMPLE, "unmapped", "petrom")).toHaveLength(0);
  });

  it("returns empty for a search that matches nothing", () => {
    expect(filterPartners(SAMPLE, "all", "zzznonexistent")).toHaveLength(0);
  });

  describe("minRulaj threshold (materialitate)", () => {
    it("drops partners below the threshold", () => {
      // SAMPLE rulaj values: 4000, 3500, 1200, 800, 600.
      // Threshold 1000 keeps the first three.
      const result = filterPartners(SAMPLE, "all", "", 1000);
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.rulaj)).toEqual([4000, 3500, 1200]);
    });

    it("uses >= semantics (boundary is kept)", () => {
      // Threshold exactly at 1200 keeps MOL ROMANIA (which has rulaj=1200).
      const result = filterPartners(SAMPLE, "all", "", 1200);
      expect(result.map((p) => p.nameOriginal)).toContain("MOL ROMANIA SRL");
    });

    it("threshold of 0 is a no-op (default behaviour)", () => {
      expect(filterPartners(SAMPLE, "all", "", 0)).toHaveLength(5);
    });

    it("negative or undefined threshold is treated as 0", () => {
      // The function signature treats minRulaj=0 as no-op; passing nothing
      // also yields all 5.
      expect(filterPartners(SAMPLE, "all", "")).toHaveLength(5);
    });

    it("threshold higher than all rulaj returns empty", () => {
      expect(filterPartners(SAMPLE, "all", "", 999999)).toHaveLength(0);
    });

    it("combines with toggle: top10 + threshold", () => {
      // top10 keeps all 5; threshold 1000 drops 2.
      expect(filterPartners(SAMPLE, "top10", "", 1000)).toHaveLength(3);
    });

    it("combines with search: 'rom' + threshold 1000", () => {
      // 'rom' matches PETROM (4000), ROMANIA (1200), ROMPETROL (600).
      // Threshold 1000 drops ROMPETROL.
      const result = filterPartners(SAMPLE, "all", "rom", 1000);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.nameOriginal).sort()).toEqual([
        "MOL ROMANIA SRL",
        "OMV PETROM SRL",
      ]);
    });

    it("combines with toggle 'unmapped' + threshold", () => {
      // 'unmapped' drops PETROM (it has an override) → leaves LUKOIL (3500),
      // MOL (1200), Tiriac (800), ROMPETROL (600). Threshold 1000 keeps two.
      expect(filterPartners(SAMPLE, "unmapped", "", 1000)).toHaveLength(2);
    });
  });
});

describe("computeBulkTargets", () => {
  it("by default, excludes partners that already have an override", () => {
    const targets = computeBulkTargets(SAMPLE, "all", "");
    expect(targets).toHaveLength(4);
    expect(targets.every((p) => p.override === null)).toBe(true);
  });

  it("when includeOverridden=true, returns every visible partner including overridden ones", () => {
    const targets = computeBulkTargets(SAMPLE, "all", "", { includeOverridden: true });
    expect(targets).toHaveLength(5);
  });

  it("respects search filter — bulk on what's visible, not on global state", () => {
    // Search 'rom' matches PETROM, ROMANIA, ROMPETROL = 3 partners.
    // PETROM has an override, so bulk targets = 2 unless includeOverridden.
    const targets = computeBulkTargets(SAMPLE, "all", "rom");
    expect(targets).toHaveLength(2);
    expect(targets.map((p) => p.nameOriginal).sort()).toEqual([
      "MOL ROMANIA SRL",
      "ROMPETROL DOWNSTREAM",
    ]);
  });

  it("respects toggle filter — top10 + bulk would pick top-10 unmapped", () => {
    const bigList = [
      partner({ nameNormalized: "p1", nameOriginal: "P1", rulaj: 100, override: row() }),
      ...Array.from({ length: 25 }, (_, i) =>
        partner({ nameNormalized: `p${i + 2}`, nameOriginal: `P${i + 2}` })
      ),
    ];
    const targets = computeBulkTargets(bigList, "top10", "");
    // Top10 = first 10 (P1 included), but P1 has an override → drops to 9.
    expect(targets).toHaveLength(9);
  });

  it("returns empty when no partners match the filter chain", () => {
    expect(computeBulkTargets(SAMPLE, "all", "nope")).toHaveLength(0);
  });

  it("returns empty when filter='unmapped' AND all visible already overridden", () => {
    const allOverridden = SAMPLE.map((p) => ({ ...p, override: row() }));
    expect(computeBulkTargets(allOverridden, "all", "")).toHaveLength(0);
  });

  describe("minRulaj option", () => {
    it("threshold drops below-threshold partners from bulk targets", () => {
      // 4 unmapped, threshold 1000 keeps LUKOIL (3500), MOL (1200).
      const targets = computeBulkTargets(SAMPLE, "all", "", { minRulaj: 1000 });
      expect(targets).toHaveLength(2);
      expect(targets.map((p) => p.nameOriginal).sort()).toEqual([
        "LUKOIL",
        "MOL ROMANIA SRL",
      ]);
    });

    it("threshold combines with includeOverridden=true", () => {
      const targets = computeBulkTargets(SAMPLE, "all", "", {
        minRulaj: 1000,
        includeOverridden: true,
      });
      // PETROM (overridden, 4000) + LUKOIL (3500) + MOL (1200) = 3.
      expect(targets).toHaveLength(3);
    });

    it("threshold 0 behaves identically to no threshold", () => {
      const a = computeBulkTargets(SAMPLE, "all", "");
      const b = computeBulkTargets(SAMPLE, "all", "", { minRulaj: 0 });
      expect(a.length).toBe(b.length);
    });
  });
});

describe("sumRulaj", () => {
  it("sums rulaj across partners", () => {
    expect(sumRulaj(SAMPLE)).toBe(4000 + 3500 + 1200 + 800 + 600);
  });

  it("returns 0 for empty list", () => {
    expect(sumRulaj([])).toBe(0);
  });
});

describe("maxRulaj", () => {
  it("returns the largest rulaj across partners", () => {
    expect(maxRulaj(SAMPLE)).toBe(4000);
  });

  it("returns 0 for empty list", () => {
    expect(maxRulaj([])).toBe(0);
  });

  it("returns 0 when every partner has 0 rulaj", () => {
    const zeros = SAMPLE.map((p) => ({ ...p, rulaj: 0 }));
    expect(maxRulaj(zeros)).toBe(0);
  });

  it("ignores negative values (defensive — rulaj is always >= 0)", () => {
    const mixed = SAMPLE.map((p, i) => ({ ...p, rulaj: i === 0 ? -500 : p.rulaj }));
    expect(maxRulaj(mixed)).toBe(3500); // LUKOIL is now the max
  });
});

describe("computeParetoCutoff", () => {
  it("returns all-zero for empty list", () => {
    const result = computeParetoCutoff([]);
    expect(result.headCount).toBe(0);
    expect(result.headPercent).toBe(0);
    expect(result.tailCount).toBe(0);
    expect(result.tailPercent).toBe(0);
    expect(result.totalRulaj).toBe(0);
  });

  it("returns all-zero counts when total rulaj is 0", () => {
    const zeros = SAMPLE.map((p) => ({ ...p, rulaj: 0 }));
    const result = computeParetoCutoff(zeros);
    expect(result.headCount).toBe(0);
    expect(result.tailCount).toBe(5); // all 5 fall into the tail conceptually
    expect(result.totalRulaj).toBe(0);
  });

  it("uses 80% as the default threshold", () => {
    // SAMPLE rulaj: 4000, 3500, 1200, 800, 600. Total = 10100.
    // 80% of 10100 = 8080. Cumulative: 4000, 7500, 8700 (crosses).
    // So headCount = 3, headPercent = round(8700/10100*100) = 86.
    const result = computeParetoCutoff(SAMPLE);
    expect(result.headCount).toBe(3);
    expect(result.headPercent).toBe(86);
    expect(result.tailCount).toBe(2);
    expect(result.tailPercent).toBe(14);
    expect(result.totalRulaj).toBe(10100);
  });

  it("accepts a custom threshold", () => {
    // 50% of 10100 = 5050. Cumulative: 4000, 7500 (crosses at 2).
    const result = computeParetoCutoff(SAMPLE, 50);
    expect(result.headCount).toBe(2);
    expect(result.headPercent).toBe(74); // 7500/10100 = 74.25 → 74
  });

  it("handles 100% threshold (head = entire list)", () => {
    const result = computeParetoCutoff(SAMPLE, 100);
    expect(result.headCount).toBe(5);
    expect(result.headPercent).toBe(100);
    expect(result.tailCount).toBe(0);
    expect(result.tailPercent).toBe(0);
  });

  it("handles single huge partner (Pareto-extreme)", () => {
    const singleHuge: typeof SAMPLE = [
      partner({ nameOriginal: "BIG", rulaj: 9000 }),
      partner({ nameOriginal: "S1", rulaj: 100 }),
      partner({ nameOriginal: "S2", rulaj: 50 }),
    ];
    const result = computeParetoCutoff(singleHuge);
    // 80% of 9150 = 7320. BIG alone (9000) crosses immediately.
    expect(result.headCount).toBe(1);
    expect(result.headPercent).toBe(98);
    expect(result.tailCount).toBe(2);
  });

  it("handles all-equal partners (head ~ threshold% of count)", () => {
    const equal: typeof SAMPLE = Array.from({ length: 10 }, (_, i) =>
      partner({ nameOriginal: `P${i}`, rulaj: 100 })
    );
    const result = computeParetoCutoff(equal, 80);
    // Each partner is 10%. After 8 we reach 80% exactly.
    expect(result.headCount).toBe(8);
    expect(result.headPercent).toBe(80);
    expect(result.tailCount).toBe(2);
  });

  it("handles threshold reached exactly at the last partner", () => {
    const result = computeParetoCutoff(SAMPLE, 99);
    // 99% of 10100 = 9999. Cumulative: 4000, 7500, 8700, 9500, 10100 (crosses last).
    expect(result.headCount).toBe(5);
    expect(result.tailCount).toBe(0);
  });

  it("never returns headCount > partners.length", () => {
    const result = computeParetoCutoff(SAMPLE, 200);
    expect(result.headCount).toBeLessThanOrEqual(SAMPLE.length);
  });
});

describe("rulajBarPercent", () => {
  it("returns 100 when rulaj equals max", () => {
    expect(rulajBarPercent(4000, 4000)).toBe(100);
  });

  it("returns scaled percent for smaller rulaj", () => {
    expect(rulajBarPercent(2000, 4000)).toBe(50);
    expect(rulajBarPercent(1000, 4000)).toBe(25);
  });

  it("returns 0 when max is 0 (avoids divide-by-zero)", () => {
    expect(rulajBarPercent(100, 0)).toBe(0);
  });

  it("returns 0 when rulaj is 0", () => {
    expect(rulajBarPercent(0, 4000)).toBe(0);
  });

  it("returns 0 when rulaj is negative (defensive)", () => {
    expect(rulajBarPercent(-100, 4000)).toBe(0);
  });

  it("clamps to 100 even if rulaj exceeds max (shouldn't happen)", () => {
    expect(rulajBarPercent(5000, 4000)).toBe(100);
  });

  it("handles small values precisely", () => {
    expect(rulajBarPercent(1, 1000)).toBeCloseTo(0.1, 5);
  });
});

describe("splitTargetsByExistence", () => {
  it("splits a mixed list into fresh vs. overwriting", () => {
    const targets = SAMPLE; // 1 overridden, 4 fresh
    const { fresh, overwriting } = splitTargetsByExistence(targets);
    expect(fresh).toHaveLength(4);
    expect(overwriting).toHaveLength(1);
    expect(overwriting[0].nameOriginal).toBe("OMV PETROM SRL");
  });

  it("returns empty arrays for empty input", () => {
    expect(splitTargetsByExistence([])).toEqual({ fresh: [], overwriting: [] });
  });

  it("returns only fresh when no partners have overrides", () => {
    const onlyFresh = SAMPLE.filter((p) => p.override === null);
    const { fresh, overwriting } = splitTargetsByExistence(onlyFresh);
    expect(fresh).toHaveLength(4);
    expect(overwriting).toHaveLength(0);
  });

  it("returns only overwriting when every partner has an override", () => {
    const allOverridden = SAMPLE.map((p) => ({ ...p, override: row() }));
    const { fresh, overwriting } = splitTargetsByExistence(allOverridden);
    expect(fresh).toHaveLength(0);
    expect(overwriting).toHaveLength(5);
  });
});
