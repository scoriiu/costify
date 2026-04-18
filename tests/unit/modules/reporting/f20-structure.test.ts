import { describe, it, expect, beforeEach } from "vitest";
import {
  loadF20Structure,
  resetF20Cache,
  isDetailRow,
  isComputedRow,
  type F20Row,
} from "@/modules/reporting/f20-structure";

describe("loadF20Structure", () => {
  beforeEach(() => {
    resetF20Cache();
  });

  it("loads the F20 structure seed from disk", () => {
    const s = loadF20Structure();
    expect(s).toBeDefined();
    expect(s.version).toBeTruthy();
    expect(s.rows.length).toBeGreaterThan(30);
  });

  it("caches the structure across calls (same object reference)", () => {
    const a = loadF20Structure();
    const b = loadF20Structure();
    expect(a).toBe(b);
  });

  it("resetF20Cache forces a fresh read from disk", () => {
    const a = loadF20Structure();
    resetF20Cache();
    const b = loadF20Structure();
    expect(a).not.toBe(b);
    // But the content is equivalent
    expect(a.version).toBe(b.version);
    expect(a.rows.length).toBe(b.rows.length);
  });

  it("version matches the shipped identifier", () => {
    const s = loadF20Structure();
    expect(s.version).toBe("f20-omfp1802-2024-v1");
  });

  it("every row has a rowNumber, label, section, indent, kind", () => {
    const s = loadF20Structure();
    for (const row of s.rows) {
      expect(row.rowNumber).toBeTruthy();
      expect(row.label).toBeTruthy();
      expect(["A", "B", "C", "D", "E", "F", "G"]).toContain(row.section);
      expect(row.indent).toBeGreaterThanOrEqual(0);
      expect(["detail", "subtotal", "total"]).toContain(row.kind);
    }
  });

  it("detail rows carry side and accounts arrays", () => {
    const s = loadF20Structure();
    for (const row of s.rows) {
      if (row.kind === "detail") {
        expect(["D", "C"]).toContain(row.side);
        expect(Array.isArray(row.accounts)).toBe(true);
      }
    }
  });

  it("subtotal and total rows carry a formula", () => {
    const s = loadF20Structure();
    for (const row of s.rows) {
      if (row.kind !== "detail") {
        expect(row.formula).toBeTruthy();
      }
    }
  });
});

describe("isDetailRow / isComputedRow type guards", () => {
  it("isDetailRow returns true only for detail rows", () => {
    const detail: F20Row = {
      rowNumber: "99",
      label: "t",
      section: "A",
      indent: 0,
      kind: "detail",
      side: "D",
      accounts: [],
    };
    const sub: F20Row = {
      rowNumber: "100",
      label: "s",
      section: "A",
      indent: 0,
      kind: "subtotal",
      formula: "rd.01",
    };
    expect(isDetailRow(detail)).toBe(true);
    expect(isDetailRow(sub)).toBe(false);
  });

  it("isComputedRow returns true for subtotal and total rows", () => {
    const sub: F20Row = {
      rowNumber: "s",
      label: "s",
      section: "A",
      indent: 0,
      kind: "subtotal",
      formula: "x",
    };
    const total: F20Row = {
      rowNumber: "t",
      label: "t",
      section: "A",
      indent: 0,
      kind: "total",
      formula: "x",
    };
    const detail: F20Row = {
      rowNumber: "d",
      label: "d",
      section: "A",
      indent: 0,
      kind: "detail",
      side: "D",
      accounts: [],
    };
    expect(isComputedRow(sub)).toBe(true);
    expect(isComputedRow(total)).toBe(true);
    expect(isComputedRow(detail)).toBe(false);
  });

  it("detail and computed are mutually exclusive (narrowing works)", () => {
    const s = loadF20Structure();
    for (const row of s.rows) {
      const isDet = isDetailRow(row);
      const isComp = isComputedRow(row);
      expect(isDet !== isComp).toBe(true);
    }
  });
});
