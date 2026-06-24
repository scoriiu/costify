import { describe, it, expect } from "vitest";
import {
  computeLineSeriesGeneric,
  type LineBreakdownItem,
} from "@/modules/reporting/owner/line-series";

/**
 * Deterministic PRNG (mulberry32) so property-style runs are reproducible and
 * we add no dependency. Each test seeds it explicitly.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LINE_IDS = ["salarii", "chirie", "marfa", "servicii", "utilitati"];

/** A random but 2-decimal-clean month breakdown, so aggregation is exact. */
function randomMonth(rand: () => number): LineBreakdownItem[] {
  const items: LineBreakdownItem[] = [];
  for (const id of LINE_IDS) {
    if (rand() < 0.4) continue; // line absent some months
    const cents = Math.floor(rand() * 2_000_00) - 1_000_00; // -1000.00..1000.00
    items.push({ id, label: id, value: cents / 100 });
  }
  return items;
}

function sum(ns: number[]): number {
  return Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100;
}

describe("line series invariants", () => {
  it("conservation: total of all line totals == total of all monthly values", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = rng(seed);
      const months: Record<string, LineBreakdownItem[]> = {};
      let rawTotal = 0;
      for (let m = 1; m <= 12; m++) {
        const items = randomMonth(rand);
        months[`2026-${m}`] = items;
        for (const it of items) rawTotal += it.value;
      }
      rawTotal = Math.round(rawTotal * 100) / 100;

      const res = computeLineSeriesGeneric(
        2026,
        12,
        12,
        (y, m) => months[`${y}-${m}`] ?? []
      );
      const lineTotal = sum(res.lines.map((l) => l.total));
      expect(lineTotal).toBeCloseTo(rawTotal, 2);
    }
  });

  it("total of each line equals the sum of its displayed monthly values (no drift)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = rng(seed);
      const months: Record<string, LineBreakdownItem[]> = {};
      for (let m = 1; m <= 12; m++) months[`2026-${m}`] = randomMonth(rand);
      const res = computeLineSeriesGeneric(
        2026,
        12,
        12,
        (y, m) => months[`${y}-${m}`] ?? []
      );
      for (const line of res.lines) {
        expect(line.total).toBeCloseTo(sum(line.values), 2);
      }
    }
  });

  it("determinism: shuffling items within a month never changes the result", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rand = rng(seed);
      const base: Record<string, LineBreakdownItem[]> = {};
      for (let m = 1; m <= 6; m++) base[`2026-${m}`] = randomMonth(rand);

      const straight = computeLineSeriesGeneric(2026, 6, 6, (y, m) => base[`${y}-${m}`] ?? []);
      const shuffled = computeLineSeriesGeneric(2026, 6, 6, (y, m) => {
        const items = [...(base[`${y}-${m}`] ?? [])];
        // reverse + rotate to perturb order deterministically
        items.reverse();
        return items;
      });

      const norm = (r: ReturnType<typeof computeLineSeriesGeneric>) =>
        [...r.lines].sort((a, b) => a.id.localeCompare(b.id)).map((l) => ({ id: l.id, total: l.total, values: l.values }));
      expect(norm(shuffled)).toEqual(norm(straight));
    }
  });

  it("window alignment: values length equals months length, months ascending", () => {
    const res = computeLineSeriesGeneric(2026, 4, 12, (y, m) => [
      { id: "x", label: "X", value: m },
    ]);
    expect(res.months).toHaveLength(12);
    for (const line of res.lines) expect(line.values).toHaveLength(12);
    for (let i = 1; i < res.months.length; i++) {
      const prev = res.months[i - 1];
      const cur = res.months[i];
      expect(cur.year * 100 + cur.month).toBeGreaterThan(prev.year * 100 + prev.month);
    }
  });
});
