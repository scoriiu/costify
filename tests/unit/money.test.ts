import { describe, it, expect } from "vitest";
import { normalizeMoney, round2 } from "@/lib/money";

describe("normalizeMoney", () => {
  it("handles null/undefined/empty", () => {
    expect(normalizeMoney(null)).toBe(0);
    expect(normalizeMoney(undefined)).toBe(0);
    expect(normalizeMoney("")).toBe(0);
  });

  it("handles plain numbers", () => {
    expect(normalizeMoney(1234.56)).toBe(1234.56);
    expect(normalizeMoney(0)).toBe(0);
    expect(normalizeMoney(-500)).toBe(-500);
  });

  it("handles Romanian format (comma decimal, dot thousands)", () => {
    expect(normalizeMoney("1.234.567,89")).toBe(1234567.89);
    expect(normalizeMoney("1.234,56")).toBe(1234.56);
    expect(normalizeMoney("100,50")).toBe(100.50);
  });

  it("handles ambiguous single dot with 3 trailing digits as thousands", () => {
    expect(normalizeMoney("1.234")).toBe(1234);
    expect(normalizeMoney("12.345")).toBe(12345);
  });

  it("handles normal decimal format", () => {
    expect(normalizeMoney("1234.56")).toBe(1234.56);
    expect(normalizeMoney("1.23")).toBe(1.23);
  });

  it("handles strings with spaces", () => {
    expect(normalizeMoney(" 1 234,56 ")).toBe(1234.56);
  });

  it("handles negative values", () => {
    expect(normalizeMoney("-1.234,56")).toBe(-1234.56);
  });
});

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.006)).toBe(1.01);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(0)).toBe(0);
  });
});
