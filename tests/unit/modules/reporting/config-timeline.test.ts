import { describe, it, expect } from "vitest";
import { computeCategoryConfigChanges } from "@/modules/reporting/owner/config-timeline";
import type { CategoryMappingVersion, CostCategoryNode } from "@/modules/categories";
import { periodKey, INCEPTION } from "@/lib/period";

function node(id: string, name: string, children: CostCategoryNode[] = []): CostCategoryNode {
  return {
    id,
    clientId: "c1",
    parentId: null,
    name,
    kind: "expense",
    position: 0,
    isOmfpDefault: false,
    children,
    mappingCount: 0,
  };
}

const marfa = node("marfa", "Marfa");
const servicii = node("servicii", "Servicii externe");
const tree = [marfa, servicii];

function months(spec: Array<[number, number]>) {
  return spec.map(([year, month]) => ({ year, month, monthLabel: `${month}` }));
}

function v(
  cont: string,
  categoryId: string | null,
  effectiveFrom: number,
  effectiveTo: number | null = null
): CategoryMappingVersion {
  return { cont, categoryId, scope: "contBase", effectiveFrom, effectiveTo };
}

const WINDOW = months([
  [2026, 1],
  [2026, 2],
  [2026, 3],
  [2026, 4],
]);

describe("computeCategoryConfigChanges", () => {
  it("inception-only mapping produces no changes in the window", () => {
    const versions = [v("62", "servicii", INCEPTION)];
    const res = computeCategoryConfigChanges(tree, versions, WINDOW);
    // No root has any non-empty month.
    for (const arr of Object.values(res)) {
      for (const m of arr) expect(m.added.length + m.removed.length).toBe(0);
    }
  });

  it("a reclassification shows as removed on the old line and added on the new, same month", () => {
    const versions = [
      v("62", "servicii", INCEPTION),
      v("62", "marfa", periodKey(2026, 3)),
    ];
    const res = computeCategoryConfigChanges(tree, versions, WINDOW);
    // Index 2 == March.
    expect(res["servicii"][2].removed).toEqual([{ cont: "62", otherLabel: "Marfa" }]);
    expect(res["marfa"][2].added).toEqual([{ cont: "62", otherLabel: "Servicii externe" }]);
    // Other months untouched.
    expect(res["marfa"][1].added).toEqual([]);
    expect(res["servicii"][3].removed).toEqual([]);
  });

  it("an open tombstone shows as removed (to 'nemapat') and added nowhere", () => {
    const versions = [
      v("62", "servicii", INCEPTION),
      v("62", null, periodKey(2026, 2)),
    ];
    const res = computeCategoryConfigChanges(tree, versions, WINDOW);
    expect(res["servicii"][1].removed).toEqual([{ cont: "62", otherLabel: "nemapat" }]);
    // No "marfa" additions anywhere.
    expect(res["marfa"]?.some((m) => m.added.length > 0) ?? false).toBe(false);
  });

  it("a bounded override produces a change in AND out (window edges)", () => {
    const versions = [
      v("62", "servicii", INCEPTION),
      v("62", "marfa", periodKey(2026, 2), periodKey(2026, 2)),
    ];
    const res = computeCategoryConfigChanges(tree, versions, WINDOW);
    // Feb: into marfa, out of servicii.
    expect(res["marfa"][1].added).toEqual([{ cont: "62", otherLabel: "Servicii externe" }]);
    expect(res["servicii"][1].removed).toEqual([{ cont: "62", otherLabel: "Marfa" }]);
    // Mar: reverts -> back into servicii, out of marfa.
    expect(res["servicii"][2].added).toEqual([{ cont: "62", otherLabel: "Marfa" }]);
    expect(res["marfa"][2].removed).toEqual([{ cont: "62", otherLabel: "Servicii externe" }]);
  });

  it("a change that happened before the window does not appear inside it", () => {
    const versions = [
      v("62", "servicii", INCEPTION),
      v("62", "marfa", periodKey(2025, 12)), // before window start (Jan 2026)
    ];
    const res = computeCategoryConfigChanges(tree, versions, WINDOW);
    // 62 is already on marfa for the whole window -> no in-window change.
    for (const arr of Object.values(res)) {
      for (const m of arr) expect(m.added.length + m.removed.length).toBe(0);
    }
  });

  it("maps a child-category mapping up to its root line", () => {
    const sub = node("marfa-sub", "Marfa ambalaje");
    const marfaParent: CostCategoryNode = { ...marfa, children: [{ ...sub, parentId: "marfa" }] };
    const t = [marfaParent, servicii];
    const versions = [
      v("62", "servicii", INCEPTION),
      v("62", "marfa-sub", periodKey(2026, 3)),
    ];
    const res = computeCategoryConfigChanges(t, versions, WINDOW);
    // Lands on the ROOT "marfa", not the sub id.
    expect(res["marfa"][2].added).toEqual([{ cont: "62", otherLabel: "Servicii externe" }]);
    expect(res["marfa-sub"]).toBeUndefined();
  });

  it("returns {} for an empty month window", () => {
    expect(computeCategoryConfigChanges(tree, [v("62", "servicii", INCEPTION)], [])).toEqual({});
  });
});
