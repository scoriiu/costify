import { describe, it, expect } from "vitest";
import {
  aggregatePartnersForCont,
  summarizePartnersForCont,
  type JournalLineForAggregation,
  type ContKind,
} from "@/modules/partner-mappings/aggregator";
import type { PartnerCategoryOverrideRow } from "@/modules/partner-mappings";

function line(
  overrides: Partial<JournalLineForAggregation> = {}
): JournalLineForAggregation {
  return {
    contD: "6022",
    contDBase: "6022",
    contC: "401.001",
    contCBase: "401",
    suma: 100,
    ...overrides,
  };
}

function override(
  overrides: Partial<PartnerCategoryOverrideRow> = {}
): PartnerCategoryOverrideRow {
  return {
    id: "override-1",
    clientId: "client-1",
    contBase: "6022",
    partnerNameNormalized: "omv petrom",
    partnerNameOriginal: "OMV PETROM SRL",
    categoryId: "cat-combustibil",
    source: "manual",
    confirmedAt: new Date("2026-04-15"),
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-15"),
    ...overrides,
  };
}

describe("aggregatePartnersForCont", () => {
  describe("expense (class 6) — partner on credit side", () => {
    it("returns one entry per distinct partner with summed rulaj", () => {
      const lines = [
        line({ contC: "401.001", suma: 100 }),
        line({ contC: "401.001", suma: 200 }),
        line({ contC: "401.002", suma: 50 }),
      ];
      const names = new Map([
        ["401.001", "OMV PETROM SRL"],
        ["401.002", "PETROM SRL"],
      ]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners).toHaveLength(2);
      expect(result.partnerRulaj).toBe(350);
      expect(result.unresolvedRulaj).toBe(0);
    });

    it("collapses spelling variants of the same partner into one entry", () => {
      const lines = [
        line({ contC: "401.001", suma: 100 }),
        line({ contC: "401.002", suma: 200 }),
        line({ contC: "401.003", suma: 50 }),
      ];
      const names = new Map([
        ["401.001", "OMV PETROM SRL"],
        ["401.002", "OMV Petrom S.R.L."],
        ["401.003", "omv petrom"],
      ]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners).toHaveLength(1);
      expect(result.partners[0].nameNormalized).toBe("omv petrom");
      expect(result.partners[0].rulaj).toBe(350);
    });

    it("sorts entries DESC by rulaj — materialitatea conduce", () => {
      const lines = [
        line({ contC: "401.001", suma: 100 }),
        line({ contC: "401.002", suma: 500 }),
        line({ contC: "401.003", suma: 250 }),
      ];
      const names = new Map([
        ["401.001", "Alfa SRL"],
        ["401.002", "Beta SRL"],
        ["401.003", "Gamma SRL"],
      ]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners.map((p) => p.nameNormalized)).toEqual([
        "beta",
        "gamma",
        "alfa",
      ]);
    });

    it("attaches the override to the matching partner entry", () => {
      const lines = [line({ contC: "401.001", suma: 900 })];
      const names = new Map([["401.001", "SC Logistic SRL"]]);
      const overrides = [
        override({
          partnerNameNormalized: "logistic",
          partnerNameOriginal: "SC Logistic SRL",
          categoryId: "cat-curierat",
        }),
      ];

      const result = aggregatePartnersForCont("expense", lines, names, overrides);

      expect(result.partners[0].override).not.toBeNull();
      expect(result.partners[0].override?.categoryId).toBe("cat-curierat");
    });

    it("override-only entry (no journal activity) appears at the bottom with rulaj=0", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "OMV PETROM SRL"]]);
      const overrides = [
        override({
          partnerNameNormalized: "omv petrom",
          partnerNameOriginal: "OMV PETROM SRL",
        }),
        // This partner had an override last year but didn't invoice this period:
        override({
          id: "override-2",
          partnerNameNormalized: "lukoil",
          partnerNameOriginal: "LUKOIL ROMANIA",
          categoryId: "cat-combustibil",
        }),
      ];

      const result = aggregatePartnersForCont("expense", lines, names, overrides);

      expect(result.partners).toHaveLength(2);
      expect(result.partners[0].nameNormalized).toBe("omv petrom");
      expect(result.partners[0].rulaj).toBe(500);
      expect(result.partners[1].nameNormalized).toBe("lukoil");
      expect(result.partners[1].rulaj).toBe(0);
      expect(result.partners[1].override).not.toBeNull();
    });

    it("prefers the override's original spelling for display when present", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      // The journal has a noisy spelling:
      const names = new Map([["401.001", "omv petrom  s.r.l."]]);
      // But the override has the contabil's preferred canonical spelling:
      const overrides = [
        override({
          partnerNameNormalized: "omv petrom",
          partnerNameOriginal: "OMV Petrom Marketing SRL",
        }),
      ];

      const result = aggregatePartnersForCont("expense", lines, names, overrides);

      expect(result.partners[0].nameOriginal).toBe(
        "OMV Petrom Marketing SRL"
      );
    });

    it("buckets lines as unresolved when the opposite-side analytic has no partner name", () => {
      const lines = [
        line({ contC: "401.001", suma: 100 }), // resolved
        line({ contC: "4427", suma: 50 }), // TVA — no partner row
        line({ contC: "401.999", suma: 30 }), // partner row missing
      ];
      const names = new Map([["401.001", "OMV"]]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners).toHaveLength(1);
      expect(result.partnerRulaj).toBe(100);
      expect(result.unresolvedRulaj).toBe(80); // 50 + 30
    });

    it("buckets as unresolved when the partner name is whitespace-only", () => {
      const lines = [line({ contC: "401.001", suma: 100 })];
      const names = new Map([["401.001", "   "]]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners).toHaveLength(0);
      expect(result.unresolvedRulaj).toBe(100);
    });

    it("buckets as unresolved when normalization collapses the name to empty", () => {
      // A name made entirely of legal forms normalizes to "".
      const lines = [line({ contC: "401.001", suma: 100 })];
      const names = new Map([["401.001", "SRL SA"]]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners).toHaveLength(0);
      expect(result.unresolvedRulaj).toBe(100);
    });
  });

  describe("revenue (class 7) — partner on debit side", () => {
    it("looks up partner via contD when contKind=revenue", () => {
      const lines = [
        // For revenue: debit 411.xxx / credit 707
        line({ contD: "411.001", contDBase: "411", contC: "707",
               contCBase: "707", suma: 1000 }),
      ];
      const names = new Map([["411.001", "CLIENT ALPHA SRL"]]);

      const result = aggregatePartnersForCont("revenue", lines, names, []);

      expect(result.partners).toHaveLength(1);
      expect(result.partners[0].nameNormalized).toBe("client alpha");
      expect(result.partners[0].rulaj).toBe(1000);
    });

    it("does NOT look up partner via contC on revenue conts", () => {
      const lines = [
        line({ contD: "411.001", contDBase: "411", contC: "707",
               contCBase: "707", suma: 1000 }),
      ];
      // 707 is in the partner map (it shouldn't be but defensive test):
      const names = new Map([
        ["707", "WRONG"],
        ["411.001", "RIGHT"],
      ]);

      const result = aggregatePartnersForCont("revenue", lines, names, []);

      expect(result.partners[0].nameOriginal).toBe("RIGHT");
    });
  });

  describe("edge cases", () => {
    it("returns empty result for an empty lines array", () => {
      const result = aggregatePartnersForCont(
        "expense",
        [],
        new Map(),
        []
      );
      expect(result.partners).toEqual([]);
      expect(result.partnerRulaj).toBe(0);
      expect(result.unresolvedRulaj).toBe(0);
    });

    it("rounds the partner rulaj to 2 decimals (no float drift)", () => {
      const lines = [
        line({ contC: "401.001", suma: 0.1 }),
        line({ contC: "401.001", suma: 0.2 }),
      ];
      const names = new Map([["401.001", "OMV"]]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners[0].rulaj).toBe(0.3); // not 0.30000000000000004
    });

    it("handles negative amounts (refunds / corrections) by summing algebraically", () => {
      const lines = [
        line({ contC: "401.001", suma: 1000 }),
        line({ contC: "401.001", suma: -200 }), // refund/correction
      ];
      const names = new Map([["401.001", "OMV"]]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners[0].rulaj).toBe(800);
    });
  });
});

describe("summarizePartnersForCont", () => {
  it("returns zero summary for empty input", () => {
    const result = summarizePartnersForCont("expense", [], new Map(), []);
    expect(result).toEqual({
      partnerCount: 0,
      mappedPartnerCount: 0,
      totalPartnerRulaj: 0,
      overriddenRulaj: 0,
      unresolvedRulaj: 0,
    });
  });

  it("counts mapped vs total partners + sums overridden rulaj", () => {
    const lines = [
      line({ contC: "401.001", suma: 900 }),
      line({ contC: "401.002", suma: 500 }),
      line({ contC: "401.003", suma: 100 }),
    ];
    const names = new Map([
      ["401.001", "SC Logistic SRL"], // overridden
      ["401.002", "OMV PETROM SRL"], // not overridden
      ["401.003", "Lukoil"], // not overridden
    ]);
    const overrides = [
      override({
        partnerNameNormalized: "logistic",
        partnerNameOriginal: "SC Logistic SRL",
        categoryId: "cat-curierat",
      }),
    ];

    const result = summarizePartnersForCont(
      "expense",
      lines,
      names,
      overrides
    );

    expect(result.partnerCount).toBe(3);
    expect(result.mappedPartnerCount).toBe(1);
    expect(result.totalPartnerRulaj).toBe(1500);
    expect(result.overriddenRulaj).toBe(900);
  });

  it("includes unresolved rulaj separately so the caller can show a 'fara partener' line", () => {
    const lines = [
      line({ contC: "401.001", suma: 100 }),
      line({ contC: "4427", suma: 30 }), // unresolved
    ];
    const names = new Map([["401.001", "OMV"]]);

    const result = summarizePartnersForCont("expense", lines, names, []);

    expect(result.partnerCount).toBe(1);
    expect(result.totalPartnerRulaj).toBe(100);
    expect(result.unresolvedRulaj).toBe(30);
  });

  it("counts override-only entries as both a partner and a mapped partner", () => {
    const lines: JournalLineForAggregation[] = [];
    const names = new Map<string, string>();
    const overrides = [
      override({
        partnerNameNormalized: "lukoil",
        partnerNameOriginal: "LUKOIL",
      }),
    ];

    const result = summarizePartnersForCont(
      "expense",
      lines,
      names,
      overrides
    );

    expect(result.partnerCount).toBe(1);
    expect(result.mappedPartnerCount).toBe(1);
    expect(result.totalPartnerRulaj).toBe(0);
    expect(result.overriddenRulaj).toBe(0);
  });
});
