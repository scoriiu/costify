import { describe, it, expect } from "vitest";
import {
  computePeriodConfigOverview,
  type ConfigOverviewInput,
} from "@/modules/reporting/owner/config-overview";
import { computeConfigChangelog } from "@/modules/reporting/owner/config-changelog";
import type { CostCategoryNode } from "@/modules/categories";

function cat(id: string, name: string): CostCategoryNode {
  return {
    id,
    clientId: "cl",
    parentId: null,
    name,
    kind: "expense",
    position: 0,
    isOmfpDefault: false,
    children: [],
    mappingCount: 0,
  };
}

/** Defaults: data runs through April 2026, user viewing February 2026. */
function base(overrides: Partial<ConfigOverviewInput>): ConfigOverviewInput {
  return {
    latestYear: 2026,
    latestMonth: 4,
    selectedYear: 2026,
    selectedMonth: 2,
    windowMonths: 12,
    tree: [cat("c1", "Servicii externe"), cat("c2", "Marfa")],
    verticals: [
      { id: "v1", name: "Outsourcing" },
      { id: "v2", name: "Recrutare" },
    ],
    catalog: new Map(),
    mappingVersions: [],
    allocVersions: [],
    catAllocVersions: [],
    firmVersions: [],
    verticalsEnabled: true,
    ...overrides,
  };
}

const v50 = [
  { verticalId: "v1", percent: 50 },
  { verticalId: "v2", percent: 50 },
];

describe("computePeriodConfigOverview", () => {
  it("does not surface a constant (inception-only) mapping", () => {
    const out = computePeriodConfigOverview(
      base({
        mappingVersions: [
          { cont: "6123", categoryId: "c1", scope: "contBase", effectiveFrom: 0, effectiveTo: null },
        ],
      })
    );
    expect(out).toHaveLength(0);
  });

  it("a single-month 'Doar februarie' split reverts AFTER February (visible while viewing Feb)", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [
          { categoryId: "c1", splits: v50, effectiveFrom: 202602, effectiveTo: 202602 },
        ],
      })
    );
    expect(out).toHaveLength(1);
    const segs = out[0].segments;
    // The timeline must reach past February (latest data is April), so the
    // revert to "no split" is shown - not just the Feb split.
    const feb = segs.find((s) => s.fromMonth === 2 && s.fromYear === 2026)!;
    expect(feb.valueLabel).toBe("50% Outsourcing, 50% Recrutare");
    expect(feb.current).toBe(true);
    expect(feb.toMonth).toBe(2); // bounded to February only

    const after = segs.find((s) => s.fromYear === 2026 && s.fromMonth === 3)!;
    expect(after.valueLabel).toBe("Fara impartire proprie");
    expect(after.toMonth).toBe(4); // through the latest data month
  });

  it("layered open versions: from Jan A, from March B -> Jan-Feb A, Mar-now B", () => {
    const A = [{ verticalId: "v1", percent: 100 }];
    const B = v50;
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [
          { categoryId: "c1", splits: A, effectiveFrom: 202601, effectiveTo: null },
          { categoryId: "c1", splits: B, effectiveFrom: 202603, effectiveTo: null },
        ],
      })
    );
    expect(out).toHaveLength(1);
    const segs = out[0].segments;
    const janFeb = segs.find((s) => s.fromMonth === 1 && s.fromYear === 2026)!;
    expect(janFeb).toMatchObject({ toMonth: 2, valueLabel: "100% Outsourcing" });
    const marOnward = segs.find((s) => s.fromMonth === 3 && s.fromYear === 2026)!;
    expect(marOnward).toMatchObject({
      toMonth: 4,
      valueLabel: "50% Outsourcing, 50% Recrutare",
    });
    // Before January there was no split (shows the rule began in January).
    const before = segs.find((s) => s.fromYear === 2025)!;
    expect(before.valueLabel).toBe("Fara impartire proprie");
  });

  it("shows a tombstone as 'Fara linie de cost'", () => {
    const out = computePeriodConfigOverview(
      base({
        mappingVersions: [
          { cont: "641", categoryId: "c1", scope: "contBase", effectiveFrom: 0, effectiveTo: null },
          { cont: "641", categoryId: null, scope: "contBase", effectiveFrom: 202603, effectiveTo: null },
        ],
      })
    );
    expect(out).toHaveLength(1);
    const segs = out[0].segments;
    const before = segs.find((s) => s.valueLabel === "Servicii externe")!;
    expect(before.toMonth).toBe(2); // mapped until February
    expect(before.toYear).toBe(2026);
    const after = segs.find((s) => s.fromMonth === 3 && s.fromYear === 2026)!;
    expect(after.valueLabel).toBe("Fara linie de cost");
    expect(after.toMonth).toBe(4); // tombstone through latest data month
  });

  it("skips split items but keeps mapping items when verticals are disabled", () => {
    const out = computePeriodConfigOverview(
      base({
        verticalsEnabled: false,
        mappingVersions: [
          { cont: "6123", categoryId: "c1", scope: "contBase", effectiveFrom: 0, effectiveTo: null },
          { cont: "6123", categoryId: "c2", scope: "contBase", effectiveFrom: 202603, effectiveTo: null },
        ],
        catAllocVersions: [
          { categoryId: "c1", splits: [{ verticalId: "v1", percent: 100 }], effectiveFrom: 0, effectiveTo: null },
          { categoryId: "c1", splits: [{ verticalId: "v2", percent: 100 }], effectiveFrom: 202603, effectiveTo: null },
        ],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0].group).toBe("mapping");
  });

  it("marks the selected month with the current flag", () => {
    const out = computePeriodConfigOverview(
      base({
        selectedMonth: 3,
        catAllocVersions: [
          { categoryId: "c1", splits: v50, effectiveFrom: 202603, effectiveTo: null },
        ],
      })
    );
    const segs = out[0].segments;
    const current = segs.find((s) => s.current)!;
    expect(current.fromMonth).toBe(3);
    expect(current.valueLabel).toBe("50% Outsourcing, 50% Recrutare");
  });
});

const s8020 = [
  { verticalId: "v1", percent: 80 },
  { verticalId: "v2", percent: 20 },
];
const s7030 = [
  { verticalId: "v1", percent: 70 },
  { verticalId: "v2", percent: 30 },
];

function mapTo(cont: string, categoryId: string | null, from = 0, to: number | null = null) {
  return { cont, categoryId, scope: "contBase" as const, effectiveFrom: from, effectiveTo: to };
}
function contSplit(
  cont: string,
  splits: { verticalId: string; percent: number }[],
  from = 0,
  to: number | null = null
) {
  return { cont, scope: "contBase" as const, splits, effectiveFrom: from, effectiveTo: to };
}
function catItem(out: ReturnType<typeof computePeriodConfigOverview>, catId: string) {
  return out.find((i) => i.id === `cat:${catId}`);
}

describe("computePeriodConfigOverview - deviations within a line (overrides)", () => {
  it("surfaces a constant 50/50 line when a cont deviates in a SINGLE month", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 0, effectiveTo: null }],
        mappingVersions: [mapTo("707", "c1")],
        allocVersions: [contSplit("707", s8020, 202602, 202602)],
      })
    );
    const item = catItem(out, "c1")!;
    // Headline split never changes -> one segment, but it is NOT uniform.
    expect(item.segments).toHaveLength(1);
    const seg = item.segments[0];
    expect(seg.valueLabel).toBe("50% Outsourcing, 50% Recrutare");
    expect(seg.overrides).toHaveLength(1);
    const ov = seg.overrides![0];
    expect(ov.key).toBe("707");
    expect(ov.segments).toEqual([
      { fromYear: 2026, fromMonth: 2, toYear: 2026, toMonth: 2, valueLabel: "80% Outsourcing, 20% Recrutare" },
    ]);
  });

  it("captures a cont whose deviation CHANGES month by month (80/20 Feb, 70/30 Mar+)", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 0, effectiveTo: null }],
        mappingVersions: [mapTo("707", "c1")],
        allocVersions: [
          contSplit("707", s8020, 202602, 202602),
          contSplit("707", s7030, 202603, null),
        ],
      })
    );
    const ov = catItem(out, "c1")!.segments[0].overrides!.find((o) => o.key === "707")!;
    expect(ov.segments).toEqual([
      { fromYear: 2026, fromMonth: 2, toYear: 2026, toMonth: 2, valueLabel: "80% Outsourcing, 20% Recrutare" },
      { fromYear: 2026, fromMonth: 3, toYear: 2026, toMonth: 4, valueLabel: "70% Outsourcing, 30% Recrutare" },
    ]);
  });

  it("does NOT flag a cont whose split equals the category split (no real deviation)", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 0, effectiveTo: null }],
        mappingVersions: [mapTo("707", "c1")],
        allocVersions: [contSplit("707", v50, 202602, null)],
      })
    );
    // Constant headline + no real deviation -> the line is uniform -> not surfaced.
    expect(catItem(out, "c1")).toBeUndefined();
  });

  it("stops the deviation when the cont is remapped to another line mid-window", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 0, effectiveTo: null }],
        mappingVersions: [mapTo("707", "c1", 0, null), mapTo("707", "c2", 202603, null)],
        allocVersions: [contSplit("707", s8020, 0, null)],
      })
    );
    const ov = catItem(out, "c1")!.segments[0].overrides!.find((o) => o.key === "707")!;
    // 707 deviates from c1 only while it BELONGS to c1 (through February).
    expect(ov.segments).toHaveLength(1);
    expect(ov.segments[0].toYear).toBe(2026);
    expect(ov.segments[0].toMonth).toBe(2);
    expect(ov.segments[0].valueLabel).toBe("80% Outsourcing, 20% Recrutare");
  });

  it("combines a changing headline with a deviation only in the split month", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 202602, effectiveTo: 202602 }],
        mappingVersions: [mapTo("707", "c1")],
        allocVersions: [contSplit("707", s8020, 202602, 202602)],
      })
    );
    const item = catItem(out, "c1")!;
    const feb = item.segments.find((s) => s.fromMonth === 2 && s.fromYear === 2026)!;
    expect(feb.valueLabel).toBe("50% Outsourcing, 50% Recrutare");
    expect(feb.overrides![0].segments).toEqual([
      { fromYear: 2026, fromMonth: 2, toYear: 2026, toMonth: 2, valueLabel: "80% Outsourcing, 20% Recrutare" },
    ]);
    // The "fara impartire" segments around Feb carry no deviation.
    const after = item.segments.find((s) => s.fromMonth === 3 && s.fromYear === 2026)!;
    expect(after.overrides).toBeUndefined();
  });

  it("lists multiple deviating conts under one line, sorted by label", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 0, effectiveTo: null }],
        mappingVersions: [mapTo("707", "c1"), mapTo("704", "c1")],
        allocVersions: [
          contSplit("707", s8020, 202602, null),
          contSplit("704", s7030, 202602, null),
        ],
      })
    );
    const ovs = catItem(out, "c1")!.segments[0].overrides!;
    expect(ovs.map((o) => o.key)).toEqual(["704", "707"]);
  });
});

describe("computeConfigChangelog", () => {
  it("turns each segment boundary into a before -> after entry, newest first", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [
          { categoryId: "c1", splits: [{ verticalId: "v1", percent: 100 }], effectiveFrom: 0, effectiveTo: null },
          { categoryId: "c1", splits: v50, effectiveFrom: 202602, effectiveTo: 202602 },
        ],
      })
    );
    const log = computeConfigChangelog(out);
    // Two boundaries: into Feb (100 -> 50/50) and out of Feb (50/50 -> 100).
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({
      year: 2026,
      month: 3,
      title: "Servicii externe",
      fromLabel: "50% Outsourcing, 50% Recrutare",
      toLabel: "100% Outsourcing",
    });
    expect(log[1]).toMatchObject({
      month: 2,
      fromLabel: "100% Outsourcing",
      toLabel: "50% Outsourcing, 50% Recrutare",
      current: true,
    });
  });

  it("does NOT log a constant per-cont deviation (it never transitions)", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [{ categoryId: "c1", splits: v50, effectiveFrom: 0, effectiveTo: null }],
        mappingVersions: [{ cont: "707", categoryId: "c1", scope: "contBase", effectiveFrom: 0, effectiveTo: null }],
        allocVersions: [{ cont: "707", scope: "contBase", splits: [{ verticalId: "v1", percent: 80 }, { verticalId: "v2", percent: 20 }], effectiveFrom: 0, effectiveTo: null }],
      })
    );
    // The line surfaces (it has a deviation) but its headline never changes...
    expect(catItem(out, "c1")).toBeDefined();
    // ...so the changelog is empty: a constant deviation is not a change.
    expect(computeConfigChangelog(out)).toHaveLength(0);
  });

  it("groups changes from different lines under the same month, sorted by title", () => {
    const out = computePeriodConfigOverview(
      base({
        catAllocVersions: [
          { categoryId: "c1", splits: [{ verticalId: "v1", percent: 100 }], effectiveFrom: 0, effectiveTo: null },
          { categoryId: "c1", splits: v50, effectiveFrom: 202602, effectiveTo: null },
          { categoryId: "c2", splits: [{ verticalId: "v2", percent: 100 }], effectiveFrom: 0, effectiveTo: null },
          { categoryId: "c2", splits: v50, effectiveFrom: 202602, effectiveTo: null },
        ],
      })
    );
    const log = computeConfigChangelog(out);
    const feb = log.filter((c) => c.month === 2 && c.year === 2026);
    expect(feb).toHaveLength(2);
    expect(feb.map((c) => c.title)).toEqual(["Marfa", "Servicii externe"]);
  });
});
