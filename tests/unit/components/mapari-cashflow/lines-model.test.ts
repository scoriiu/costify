import { describe, it, expect } from "vitest";
import {
  buildModel,
  FIRMA_ID,
  type LineModel,
} from "@/components/clients/mapari-cashflow/lines-model";
import type { AccountListItem, CostCategoryNode } from "@/modules/categories";
import type { VerticalView } from "@/modules/verticals";

const OUTS = "vert-outsourcing";
const RECR = "vert-recruitment";
const DEFAULT_VERT = "vert-default";

function vertical(overrides: Partial<VerticalView> = {}): VerticalView {
  return {
    id: OUTS,
    clientId: "client-1",
    name: "Outsourcing",
    position: 1,
    isDefault: false,
    allocationCount: 0,
    ...overrides,
  };
}

const VERTICALS: VerticalView[] = [
  vertical({ id: DEFAULT_VERT, name: "Toata firma", position: 0, isDefault: true }),
  vertical({ id: OUTS, name: "Outsourcing", position: 1 }),
  vertical({ id: RECR, name: "Recruitment", position: 2 }),
];

function category(overrides: Partial<CostCategoryNode> = {}): CostCategoryNode {
  return {
    id: "cat-vanzari",
    clientId: "client-1",
    parentId: null,
    name: "Vanzari",
    kind: "revenue",
    position: 0,
    isOmfpDefault: false,
    children: [],
    mappingCount: 0,
    ...overrides,
  };
}

function account(overrides: Partial<AccountListItem> = {}): AccountListItem {
  return {
    cont: "704",
    contBase: "704",
    denumire: "Venituri din servicii prestate",
    kind: "revenue",
    rulajD: 0,
    rulajC: 0,
    currentMapping: { categoryId: "cat-vanzari", scope: "contBase" },
    hasAnalyticOverride: false,
    currentAllocation: null,
    effectiveAllocation: { splits: [], source: "default" },
    hasAnalyticVerticalOverride: false,
    partnerCount: 0,
    partnerOverrideCount: 0,
    partnerOverriddenRulaj: 0,
    partnerLobOverrideCount: 0,
    partnerLobByVertical: {},
    partnerLobPinnedRulaj: 0,
    mappingPeriodScoped: false,
    ...overrides,
  };
}

function lineById(lines: LineModel[], id: string): LineModel | undefined {
  return lines.find((l) => l.vertical.id === id);
}

function reconcile(model: { lines: LineModel[]; firmExpenses: number; firmRevenues: number }) {
  const revSum = model.lines.reduce((s, l) => s + l.revenues, 0);
  const expSum = model.lines.reduce((s, l) => s + l.expenses, 0);
  expect(revSum).toBeCloseTo(model.firmRevenues, 6);
  expect(expSum).toBeCloseTo(model.firmExpenses, 6);
}

describe("buildModel — partner-pinned money routing", () => {
  it("routes partner pins to their lines when the cont has NO cascade split (the qhm21 prod scenario)", () => {
    // 704 = 2.838.000 rulaj: Roche 2.614.387 -> Outsourcing, Thales 68.831 ->
    // Recruitment, rest unpinned. No cont/category split configured.
    const a = account({
      rulajC: 2838000,
      partnerLobByVertical: { [OUTS]: 2614387, [RECR]: 68831 },
      partnerLobPinnedRulaj: 2683218,
    });
    const model = buildModel([a], VERTICALS, [category()]);

    expect(lineById(model.lines, OUTS)?.revenues).toBeCloseTo(2614387, 2);
    expect(lineById(model.lines, RECR)?.revenues).toBeCloseTo(68831, 2);
    // Only the unpinned remainder falls to "Toata firma".
    expect(lineById(model.lines, FIRMA_ID)?.revenues).toBeCloseTo(
      2838000 - 2683218,
      2
    );
    // The cont is visible in every line it feeds.
    expect(lineById(model.lines, OUTS)?.contCount).toBe(1);
    expect(lineById(model.lines, RECR)?.contCount).toBe(1);
    reconcile(model);
  });

  it("applies the cascade split only to the unpinned remainder", () => {
    // rulaj 1000, pinned 400 to Outsourcing; cascade says 50/50 Outs/Recr.
    // Outsourcing: 400 + 300 = 700; Recruitment: 300.
    const a = account({
      rulajC: 1000,
      partnerLobByVertical: { [OUTS]: 400 },
      partnerLobPinnedRulaj: 400,
      effectiveAllocation: {
        splits: [
          { verticalId: OUTS, percent: 50 },
          { verticalId: RECR, percent: 50 },
        ],
        source: "category",
      },
    });
    const model = buildModel([a], VERTICALS, [category()]);

    expect(lineById(model.lines, OUTS)?.revenues).toBeCloseTo(700, 6);
    expect(lineById(model.lines, RECR)?.revenues).toBeCloseTo(300, 6);
    expect(lineById(model.lines, FIRMA_ID)).toBeUndefined();
    reconcile(model);
  });

  it("distributes contBase-grain pins across sibling analytic leaves without double counting", () => {
    // Two leaves under 6022 with rulaj 600/400; the base carries 500 pinned
    // to Outsourcing. Each leaf contributes proportionally (300 + 200), so
    // Outsourcing gets exactly 500 — not 1000.
    const shared = {
      contBase: "6022",
      kind: "expense" as const,
      currentMapping: { categoryId: "cat-comb", scope: "contBase" as const },
      partnerLobByVertical: { [OUTS]: 500 },
      partnerLobPinnedRulaj: 500,
    };
    const a1 = account({ ...shared, cont: "6022.01", rulajD: 600 });
    const a2 = account({ ...shared, cont: "6022.02", rulajD: 400 });
    const cats = [category({ id: "cat-comb", name: "Combustibil", kind: "expense" })];
    const model = buildModel([a1, a2], VERTICALS, cats);

    expect(lineById(model.lines, OUTS)?.expenses).toBeCloseTo(500, 6);
    expect(lineById(model.lines, FIRMA_ID)?.expenses).toBeCloseTo(500, 6);
    expect(lineById(model.lines, OUTS)?.contCount).toBe(2);
    reconcile(model);
  });

  it("treats pins to the DEFAULT vertical as residue (Toata firma)", () => {
    const a = account({
      rulajC: 1000,
      partnerLobByVertical: { [DEFAULT_VERT]: 1000 },
      partnerLobPinnedRulaj: 1000,
    });
    const model = buildModel([a], VERTICALS, [category()]);

    expect(lineById(model.lines, FIRMA_ID)?.revenues).toBeCloseTo(1000, 6);
    expect(lineById(model.lines, OUTS)?.revenues ?? 0).toBe(0);
    reconcile(model);
  });

  it("clamps when pinned rulaj exceeds the leaf rulaj (rounding drift)", () => {
    const a = account({
      rulajC: 100,
      partnerLobByVertical: { [OUTS]: 150 },
      partnerLobPinnedRulaj: 150,
    });
    const model = buildModel([a], VERTICALS, [category()]);

    // Everything lands on Outsourcing, nothing goes negative.
    expect(lineById(model.lines, OUTS)?.revenues).toBeCloseTo(100, 6);
    expect(lineById(model.lines, FIRMA_ID)).toBeUndefined();
    reconcile(model);
  });

  it("keeps legacy behavior when no pins exist: cascade split only", () => {
    const a = account({
      rulajC: 1000,
      effectiveAllocation: {
        splits: [{ verticalId: OUTS, percent: 70 }],
        source: "category",
      },
    });
    const model = buildModel([a], VERTICALS, [category()]);

    expect(lineById(model.lines, OUTS)?.revenues).toBeCloseTo(700, 6);
    expect(lineById(model.lines, FIRMA_ID)?.revenues).toBeCloseTo(300, 6);
    reconcile(model);
  });

  it("shows the pinned cont in the line's composition with the pinned amount", () => {
    const a = account({
      rulajC: 2838000,
      partnerLobByVertical: { [OUTS]: 2614387 },
      partnerLobPinnedRulaj: 2614387,
    });
    const model = buildModel([a], VERTICALS, [category()]);

    const outs = lineById(model.lines, OUTS)!;
    const cat = outs.categories.find((c) => c.categoryId === "cat-vanzari")!;
    expect(cat).toBeDefined();
    const slice = cat.conts.find((c) => c.account.cont === "704")!;
    expect(slice.amount).toBeCloseTo(2614387, 2);
  });
});
