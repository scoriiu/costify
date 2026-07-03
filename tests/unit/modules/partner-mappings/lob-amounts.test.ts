import { describe, it, expect } from "vitest";
import {
  summarizePartnersForCont,
  type JournalLineForAggregation,
} from "@/modules/partner-mappings/aggregator";

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

const OUTS = "vert-outsourcing";
const RECR = "vert-recruitment";

describe("summarizePartnersForCont — partner LOB pinned amounts", () => {
  it("returns empty lob fields when no pins exist", () => {
    const names = new Map([["401.001", "OMV PETROM SRL"]]);
    const s = summarizePartnersForCont("expense", [line()], names, [], []);
    expect(s.lobByVertical).toEqual({});
    expect(s.lobPinnedRulaj).toBe(0);
  });

  it("pins a partner's full rulaj to its line (100%)", () => {
    const names = new Map([
      ["401.001", "ROCHE"],
      ["401.002", "ALT FURNIZOR"],
    ]);
    const lines = [
      line({ contC: "401.001", suma: 300 }),
      line({ contC: "401.001", suma: 200 }),
      line({ contC: "401.002", suma: 999 }),
    ];
    const s = summarizePartnersForCont("expense", lines, names, [], [], [
      { partnerNameNormalized: "roche", splits: [{ verticalId: OUTS, percent: 100 }] },
    ]);
    expect(s.lobByVertical).toEqual({ [OUTS]: 500 });
    expect(s.lobPinnedRulaj).toBe(500);
  });

  it("splits a pinned partner's rulaj across lines (60/40)", () => {
    const names = new Map([["401.001", "THALES"]]);
    const s = summarizePartnersForCont(
      "expense",
      [line({ contC: "401.001", suma: 1000 })],
      names,
      [],
      [],
      [
        {
          partnerNameNormalized: "thales",
          splits: [
            { verticalId: OUTS, percent: 60 },
            { verticalId: RECR, percent: 40 },
          ],
        },
      ]
    );
    expect(s.lobByVertical).toEqual({ [OUTS]: 600, [RECR]: 400 });
    expect(s.lobPinnedRulaj).toBe(1000);
  });

  it("a partial pin (50%) leaves the other half to the cont cascade", () => {
    const names = new Map([["401.001", "ISOKINETIC"]]);
    const s = summarizePartnersForCont(
      "expense",
      [line({ contC: "401.001", suma: 200 })],
      names,
      [],
      [],
      [
        {
          partnerNameNormalized: "isokinetic",
          splits: [{ verticalId: RECR, percent: 50 }],
        },
      ]
    );
    expect(s.lobByVertical).toEqual({ [RECR]: 100 });
    expect(s.lobPinnedRulaj).toBe(100);
  });

  it("ignores pins for partners with no activity in the period", () => {
    const names = new Map([["401.001", "ACTIV SRL"]]);
    const s = summarizePartnersForCont(
      "expense",
      [line({ contC: "401.001", suma: 100 })],
      names,
      [],
      [],
      [
        { partnerNameNormalized: "fantoma", splits: [{ verticalId: OUTS, percent: 100 }] },
      ]
    );
    expect(s.lobByVertical).toEqual({});
    expect(s.lobPinnedRulaj).toBe(0);
  });

  it("aggregates on the revenue side (partner on debit)", () => {
    const names = new Map([["411.009", "IESIRE ROCHE DIAGNOSTICS"]]);
    const lines = [
      line({
        contD: "411.009",
        contDBase: "411",
        contC: "704",
        contCBase: "704",
        suma: 2614387,
      }),
    ];
    const s = summarizePartnersForCont("revenue", lines, names, [], [], [
      {
        partnerNameNormalized: "iesire roche diagnostics",
        splits: [{ verticalId: OUTS, percent: 100 }],
      },
    ]);
    expect(s.lobByVertical).toEqual({ [OUTS]: 2614387 });
    expect(s.lobPinnedRulaj).toBe(2614387);
  });

  it("does not count unresolved rulaj as pinnable", () => {
    const names = new Map<string, string>();
    const s = summarizePartnersForCont(
      "expense",
      [line({ contC: "401.099", suma: 500 })],
      names,
      [],
      [],
      [{ partnerNameNormalized: "oricine", splits: [{ verticalId: OUTS, percent: 100 }] }]
    );
    expect(s.unresolvedRulaj).toBe(500);
    expect(s.lobByVertical).toEqual({});
    expect(s.lobPinnedRulaj).toBe(0);
  });
});
