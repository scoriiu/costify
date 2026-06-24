import { describe, it, expect } from "vitest";
import {
  buildWindow,
  computeLineSeriesGeneric,
  type LineBreakdownItem,
} from "@/modules/reporting/owner/line-series";

describe("buildWindow", () => {
  it("returns `count` months oldest first ending at the target", () => {
    const w = buildWindow(2026, 4, 4);
    expect(w).toEqual([
      { year: 2026, month: 1, monthLabel: "Ian" },
      { year: 2026, month: 2, monthLabel: "Feb" },
      { year: 2026, month: 3, monthLabel: "Mar" },
      { year: 2026, month: 4, monthLabel: "Apr" },
    ]);
  });

  it("crosses the year boundary", () => {
    const w = buildWindow(2026, 2, 4);
    expect(w.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2025-11",
      "2025-12",
      "2026-1",
      "2026-2",
    ]);
  });

  it("a 12-month window ending in April spans the previous May", () => {
    const w = buildWindow(2026, 4, 12);
    expect(w).toHaveLength(12);
    expect(w[0]).toMatchObject({ year: 2025, month: 5 });
    expect(w[11]).toMatchObject({ year: 2026, month: 4 });
  });
});

describe("computeLineSeriesGeneric", () => {
  function provider(map: Record<string, LineBreakdownItem[]>) {
    return (year: number, month: number) => map[`${year}-${month}`] ?? [];
  }

  it("pivots a single line's monthly values into an aligned series", () => {
    const items = provider({
      "2026-1": [{ id: "salarii", label: "Salarii", value: 100 }],
      "2026-2": [{ id: "salarii", label: "Salarii", value: 120 }],
      "2026-3": [{ id: "salarii", label: "Salarii", value: 110 }],
    });
    const res = computeLineSeriesGeneric(2026, 3, 3, items);
    expect(res.lines).toHaveLength(1);
    expect(res.lines[0]).toMatchObject({
      id: "salarii",
      label: "Salarii",
      values: [100, 120, 110],
      total: 330,
    });
  });

  it("fills absent months with zero", () => {
    const items = provider({
      "2026-1": [{ id: "chirie", label: "Chirie", value: 50 }],
      "2026-3": [{ id: "chirie", label: "Chirie", value: 50 }],
    });
    const res = computeLineSeriesGeneric(2026, 3, 3, items);
    expect(res.lines[0].values).toEqual([50, 0, 50]);
    expect(res.lines[0].total).toBe(100);
  });

  it("sorts lines by descending absolute total", () => {
    const items = provider({
      "2026-1": [
        { id: "a", label: "A", value: 10 },
        { id: "b", label: "B", value: -90 },
        { id: "c", label: "C", value: 40 },
      ],
    });
    const res = computeLineSeriesGeneric(2026, 1, 1, items);
    expect(res.lines.map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("aggregates duplicate ids within the same month", () => {
    const items = provider({
      "2026-1": [
        { id: "x", label: "X", value: 30 },
        { id: "x", label: "X", value: 20 },
      ],
    });
    const res = computeLineSeriesGeneric(2026, 1, 1, items);
    expect(res.lines[0].total).toBe(50);
  });

  it("takes the label from the most recent month", () => {
    const items = provider({
      "2026-1": [{ id: "k", label: "Vechi", value: 1 }],
      "2026-2": [{ id: "k", label: "Nou", value: 1 }],
    });
    const res = computeLineSeriesGeneric(2026, 2, 2, items);
    expect(res.lines[0].label).toBe("Nou");
  });

  it("returns no lines for an empty provider", () => {
    const res = computeLineSeriesGeneric(2026, 6, 12, () => []);
    expect(res.lines).toEqual([]);
    expect(res.months).toHaveLength(12);
  });
});
