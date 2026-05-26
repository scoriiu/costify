import { describe, it, expect } from "vitest";
import {
  aggregatePartnersForCont,
  summarizePartnersForCont,
  computePartnerCategoryAdjustments,
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

  describe("Sprint 4 — cross-cont suggestions", () => {
    it("suggests a category when partner has exactly one override on another cont", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "SC Logistic SRL"]]);
      const crossCont: ReturnType<typeof override>[] = [
        override({
          id: "override-other-cont",
          contBase: "628",
          partnerNameNormalized: "logistic",
          categoryId: "cat-curierat",
        }),
      ];

      const result = aggregatePartnersForCont(
        "expense",
        lines,
        names,
        [],
        crossCont
      );

      expect(result.partners[0].override).toBeNull();
      expect(result.partners[0].suggestedCategoryId).toBe("cat-curierat");
    });

    it("does NOT suggest when multiple categories compete (50/50 split)", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "Ambiguous SRL"]]);
      const crossCont = [
        override({
          id: "o1",
          contBase: "628",
          partnerNameNormalized: "ambiguous",
          categoryId: "cat-a",
        }),
        override({
          id: "o2",
          contBase: "611",
          partnerNameNormalized: "ambiguous",
          categoryId: "cat-b",
        }),
      ];

      const result = aggregatePartnersForCont(
        "expense",
        lines,
        names,
        [],
        crossCont
      );

      expect(result.partners[0].suggestedCategoryId).toBeNull();
    });

    it("suggests when one category has strict majority across multiple conts", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "OMV"]]);
      const crossCont = [
        override({
          id: "o1",
          contBase: "611",
          partnerNameNormalized: "omv",
          categoryId: "cat-combustibil",
        }),
        override({
          id: "o2",
          contBase: "628",
          partnerNameNormalized: "omv",
          categoryId: "cat-combustibil",
        }),
        override({
          id: "o3",
          contBase: "658",
          partnerNameNormalized: "omv",
          categoryId: "cat-altele", // dissenter
        }),
      ];

      const result = aggregatePartnersForCont(
        "expense",
        lines,
        names,
        [],
        crossCont
      );

      // 2 votes Combustibil vs 1 vote Altele → strict majority wins.
      expect(result.partners[0].suggestedCategoryId).toBe("cat-combustibil");
    });

    it("does NOT suggest when partner already has an override on THIS cont", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "OMV"]]);
      const ownCont = [
        override({
          contBase: "6022",
          partnerNameNormalized: "omv",
          categoryId: "cat-combustibil",
        }),
      ];
      const crossCont = [
        ...ownCont,
        override({
          id: "elsewhere",
          contBase: "628",
          partnerNameNormalized: "omv",
          categoryId: "cat-altele",
        }),
      ];

      const result = aggregatePartnersForCont(
        "expense",
        lines,
        names,
        ownCont,
        crossCont
      );

      expect(result.partners[0].override).not.toBeNull();
      expect(result.partners[0].suggestedCategoryId).toBeNull();
    });

    it("returns no suggestion when only override on the same cont exists (no other-cont signal)", () => {
      // Edge case: there's a cross-cont array passed but the only entry
      // for this partner is on THIS cont — that's not a cross-cont
      // suggestion source.
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "NewPartner"]]);
      const crossCont = [
        override({
          contBase: "6022", // same as current cont
          partnerNameNormalized: "newpartner",
          categoryId: "cat-x",
        }),
      ];

      const result = aggregatePartnersForCont(
        "expense",
        lines,
        names,
        [], // no override on current cont (caller didn't pass it)
        crossCont
      );

      expect(result.partners[0].suggestedCategoryId).toBeNull();
    });

    it("default (no crossContOverrides arg) preserves Sprint 2 behavior — no suggestions", () => {
      const lines = [line({ contC: "401.001", suma: 500 })];
      const names = new Map([["401.001", "Whoever"]]);

      const result = aggregatePartnersForCont("expense", lines, names, []);

      expect(result.partners[0].suggestedCategoryId).toBeNull();
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
      suggestedPartnerCount: 0,
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

  it("Sprint 4: counts suggested partners separately from mapped partners", () => {
    const lines = [
      line({ contC: "401.001", suma: 100 }),
      line({ contC: "401.002", suma: 200 }),
      line({ contC: "401.003", suma: 300 }),
    ];
    const names = new Map([
      ["401.001", "OMV"], // suggested via cross-cont
      ["401.002", "PETROM"], // unmapped + no cross signal
      ["401.003", "SC Logistic SRL"], // already overridden on this cont
    ]);
    const overridesForCont = [
      override({
        partnerNameNormalized: "logistic",
        partnerNameOriginal: "SC Logistic SRL",
        categoryId: "cat-curierat",
      }),
    ];
    const crossCont = [
      ...overridesForCont,
      override({
        id: "other",
        contBase: "611",
        partnerNameNormalized: "omv",
        categoryId: "cat-combustibil",
      }),
    ];

    const result = summarizePartnersForCont(
      "expense",
      lines,
      names,
      overridesForCont,
      crossCont
    );

    expect(result.partnerCount).toBe(3);
    expect(result.mappedPartnerCount).toBe(1); // SC Logistic
    expect(result.suggestedPartnerCount).toBe(1); // OMV via memory
  });
});

/* ========================================================================== */
/*                  SPRINT 6 — computePartnerCategoryAdjustments              */
/* ========================================================================== */

describe("computePartnerCategoryAdjustments", () => {
  it("returns empty when there are no overrides", () => {
    const lines = [line({ contC: "401.001", suma: 500 })];
    const names = new Map([["401.001", "OMV"]]);
    expect(computePartnerCategoryAdjustments(lines, names, [])).toEqual([]);
  });

  it("returns empty when there are no journal lines", () => {
    const overrides = [override()];
    expect(
      computePartnerCategoryAdjustments([], new Map(), overrides)
    ).toEqual([]);
  });

  it("emits one adjustment per (analyticCont, targetCategory) bucket", () => {
    const lines = [
      // SC Logistic on 6022.01 → 900 lei. Override redirects to Curierat.
      line({
        contD: "6022.01",
        contDBase: "6022",
        contC: "401.001",
        suma: 900,
      }),
    ];
    const names = new Map([["401.001", "SC Logistic SRL"]]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toEqual({
      analyticCont: "6022.01",
      targetCategoryId: "cat-curierat",
      amount: 900,
    });
  });

  it("sums multiple lines of the same (analyticCont, partner) into one adjustment", () => {
    const lines = [
      line({ contD: "6022.01", contDBase: "6022", contC: "401.001", suma: 500 }),
      line({ contD: "6022.01", contDBase: "6022", contC: "401.001", suma: 300 }),
      line({ contD: "6022.01", contDBase: "6022", contC: "401.001", suma: 100 }),
    ];
    const names = new Map([["401.001", "SC Logistic SRL"]]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].amount).toBe(900);
  });

  it("emits separate adjustments for different analytics under the same contBase", () => {
    // Critical correctness case — 6022.01 and 6022.02 resolve to different
    // default categories (one has analytic mapping, one falls back), so
    // adjustments must be per-analytic to subtract from the right default.
    const lines = [
      line({ contD: "6022.01", contDBase: "6022", contC: "401.001", suma: 500 }),
      line({ contD: "6022.02", contDBase: "6022", contC: "401.001", suma: 200 }),
    ];
    const names = new Map([["401.001", "SC Logistic SRL"]]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toHaveLength(2);
    const byAnalytic = new Map(
      adjustments.map((a) => [a.analyticCont, a.amount])
    );
    expect(byAnalytic.get("6022.01")).toBe(500);
    expect(byAnalytic.get("6022.02")).toBe(200);
  });

  it("ignores lines whose partner does NOT have an override", () => {
    const lines = [
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: 900 }),
      line({ contD: "6022", contDBase: "6022", contC: "401.002", suma: 500 }),
    ];
    const names = new Map([
      ["401.001", "SC Logistic SRL"],
      ["401.002", "OMV"],
    ]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
      // OMV has no override → its 500 lei stays on the cont default.
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].amount).toBe(900);
  });

  it("ignores partner overrides for a different contBase even if the partner matches", () => {
    // SC Logistic has an override on cont 611, but the line is on cont 6022.
    // The override doesn't fire for 6022 because the (contBase, partner) key
    // doesn't match.
    const lines = [
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: 900 }),
    ];
    const names = new Map([["401.001", "SC Logistic SRL"]]);
    const overrides = [
      override({
        contBase: "611", // different cont
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toEqual([]);
  });

  it("handles revenue conts (class 7) — partner on debit side", () => {
    // Client invoice: debit 411.001 (client) / credit 707 (vanzari marfa).
    // Override redirects this client's revenue to a different category.
    const lines = [
      line({
        contD: "411.001",
        contDBase: "411",
        contC: "707",
        contCBase: "707",
        suma: 10000,
      }),
    ];
    const names = new Map([["411.001", "Client Alpha SRL"]]);
    const overrides = [
      override({
        contBase: "707",
        partnerNameNormalized: "client alpha",
        categoryId: "cat-vanzari-curierat",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toEqual({
      analyticCont: "707",
      targetCategoryId: "cat-vanzari-curierat",
      amount: 10000,
    });
  });

  it("ignores lines that aren't class 6 expense or class 7 revenue", () => {
    const lines = [
      // Transfer between bank accounts — not class 6 or 7
      line({
        contD: "5121",
        contDBase: "5121",
        contC: "5311",
        contCBase: "5311",
        suma: 1000,
      }),
    ];
    const names = new Map([["5311", "Casa"]]);
    const overrides: ReturnType<typeof override>[] = [];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toEqual([]);
  });

  it("collapses spelling variants via the partner normalizer", () => {
    const lines = [
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: 500 }),
      line({ contD: "6022", contDBase: "6022", contC: "401.002", suma: 300 }),
    ];
    // Same logical partner under two spellings — both should match the override.
    const names = new Map([
      ["401.001", "OMV PETROM SRL"],
      ["401.002", "OMV Petrom S.R.L."],
    ]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "omv petrom",
        categoryId: "cat-combustibil-special",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].amount).toBe(800);
  });

  it("drops adjustments that round to zero (perfectly canceling refunds)", () => {
    const lines = [
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: 500 }),
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: -500 }), // refund cancels
    ];
    const names = new Map([["401.001", "OMV"]]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "omv",
        categoryId: "cat-x",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments).toEqual([]);
  });

  it("rounds adjustment amount to 2 decimals (no float drift)", () => {
    const lines = [
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: 0.1 }),
      line({ contD: "6022", contDBase: "6022", contC: "401.001", suma: 0.2 }),
    ];
    const names = new Map([["401.001", "OMV"]]);
    const overrides = [
      override({
        contBase: "6022",
        partnerNameNormalized: "omv",
        categoryId: "cat-x",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    expect(adjustments[0].amount).toBe(0.3);
  });

  it("realistic mixed scenario — multiple conts, multiple partners, multiple overrides", () => {
    const lines = [
      // 6022: SC Logistic 900 (override), OMV 12300 (no override on 6022),
      //       MOL 4500 (no override at all)
      line({ contD: "6022.01", contDBase: "6022", contC: "401.001", suma: 900 }),
      line({ contD: "6022.01", contDBase: "6022", contC: "401.002", suma: 12300 }),
      line({ contD: "6022.02", contDBase: "6022", contC: "401.003", suma: 4500 }),
      // 628: SC Logistic 1500 (override on different cont)
      line({ contD: "628", contDBase: "628", contC: "401.001", suma: 1500 }),
      // 707: Client Alpha 10000 (override redirects to special)
      line({
        contD: "411.001",
        contDBase: "411",
        contC: "707",
        contCBase: "707",
        suma: 10000,
      }),
    ];
    const names = new Map([
      ["401.001", "SC Logistic SRL"],
      ["401.002", "OMV"],
      ["401.003", "MOL"],
      ["411.001", "Client Alpha"],
    ]);
    const overrides = [
      override({
        id: "o1",
        contBase: "6022",
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
      override({
        id: "o2",
        contBase: "628",
        partnerNameNormalized: "logistic",
        categoryId: "cat-curierat",
      }),
      override({
        id: "o3",
        contBase: "707",
        partnerNameNormalized: "client alpha",
        categoryId: "cat-vanzari-special",
      }),
    ];

    const adjustments = computePartnerCategoryAdjustments(
      lines,
      names,
      overrides
    );

    // 3 adjustments expected:
    //   - 6022.01 → Curierat 900 (SC Logistic on 6022)
    //   - 628 → Curierat 1500 (SC Logistic on 628)
    //   - 707 → Vanzari-special 10000 (Client Alpha on 707)
    expect(adjustments).toHaveLength(3);

    const byCont = new Map(
      adjustments.map((a) => [`${a.analyticCont}|${a.targetCategoryId}`, a.amount])
    );
    expect(byCont.get("6022.01|cat-curierat")).toBe(900);
    expect(byCont.get("628|cat-curierat")).toBe(1500);
    expect(byCont.get("707|cat-vanzari-special")).toBe(10000);
    // Total redistributed = 12400 (OMV 12300 + MOL 4500 + own-cont stays put)
  });
});
