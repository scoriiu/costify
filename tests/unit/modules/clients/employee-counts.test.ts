import { describe, it, expect } from "vitest";
import {
  resolveEmployeeCount,
  type EmployeeCountPoint,
} from "@/modules/clients/employee-counts";

describe("resolveEmployeeCount (carry-forward)", () => {
  const points: EmployeeCountPoint[] = [
    { year: 2025, month: 1, count: 8 },
    { year: 2025, month: 9, count: 10 },
  ];

  it("returns null before any explicit value exists", () => {
    expect(resolveEmployeeCount(points, 2024, 12)).toBeNull();
  });

  it("returns the explicit value for its own month", () => {
    expect(resolveEmployeeCount(points, 2025, 1)).toBe(8);
    expect(resolveEmployeeCount(points, 2025, 9)).toBe(10);
  });

  it("carries the last explicit value forward across gaps", () => {
    expect(resolveEmployeeCount(points, 2025, 5)).toBe(8);
    expect(resolveEmployeeCount(points, 2025, 8)).toBe(8);
    expect(resolveEmployeeCount(points, 2025, 12)).toBe(10);
  });

  it("carries forward into later years until overridden", () => {
    expect(resolveEmployeeCount(points, 2026, 3)).toBe(10);
  });

  it("handles fractional headcount (numar mediu)", () => {
    const frac: EmployeeCountPoint[] = [{ year: 2025, month: 1, count: 4.5 }];
    expect(resolveEmployeeCount(frac, 2025, 6)).toBe(4.5);
  });

  it("returns null for an empty set", () => {
    expect(resolveEmployeeCount([], 2025, 6)).toBeNull();
  });
});
