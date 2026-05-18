import { describe, it, expect } from "vitest";
import { parseJournalSearch } from "@/modules/ingestion/journal-search-query";

describe("parseJournalSearch", () => {
  it("treats empty input as no filter", () => {
    const r = parseJournalSearch("");
    expect(r.or).toEqual([]);
    expect(r.dateOnly).toBe(false);
  });

  it("falls back to text search for non-date queries", () => {
    const r = parseJournalSearch("7642");
    expect(r.dateOnly).toBe(false);
    expect(r.or.length).toBe(6);
    expect(r.or[0]).toEqual({ contD: { contains: "7642", mode: "insensitive" } });
  });

  it("matches exact day for DD.MM.YYYY", () => {
    const r = parseJournalSearch("15.05.2025");
    expect(r.dateOnly).toBe(true);
    expect(r.or).toHaveLength(1);
    const data = (r.or[0] as { data?: { gte: Date; lt: Date } }).data;
    expect(data?.gte.toISOString()).toBe("2025-05-15T00:00:00.000Z");
    expect(data?.lt.toISOString()).toBe("2025-05-16T00:00:00.000Z");
  });

  it("accepts ISO YYYY-MM-DD", () => {
    const r = parseJournalSearch("2025-05-15");
    expect(r.dateOnly).toBe(true);
    const data = (r.or[0] as { data?: { gte: Date; lt: Date } }).data;
    expect(data?.gte.toISOString()).toBe("2025-05-15T00:00:00.000Z");
  });

  it("accepts MM.YYYY as a month range", () => {
    const r = parseJournalSearch("05.2025");
    expect(r.dateOnly).toBe(true);
    expect(r.or[0]).toEqual({ year: 2025, month: 5 });
  });

  it("accepts YYYY-MM as a month range", () => {
    const r = parseJournalSearch("2025-05");
    expect(r.or[0]).toEqual({ year: 2025, month: 5 });
  });

  it("matches DD.MM across any year via OR of day ranges", () => {
    const r = parseJournalSearch("15.05");
    expect(r.dateOnly).toBe(true);
    const orList = (r.or[0] as { OR: Array<{ data: { gte: Date; lt: Date } }> }).OR;
    expect(orList.length).toBeGreaterThan(15);
    const may15Dates = orList.map((c) => c.data.gte.toISOString().slice(0, 10));
    expect(may15Dates).toContain("2025-05-15");
    expect(may15Dates).toContain("2024-05-15");
  });

  it("accepts year-only queries", () => {
    const r = parseJournalSearch("2025");
    expect(r.or[0]).toEqual({ year: 2025 });
  });

  it("rejects invalid dates", () => {
    const r = parseJournalSearch("32.05.2025");
    expect(r.dateOnly).toBe(false);
  });

  it("accepts dashes and slashes as separators", () => {
    const dash = parseJournalSearch("15-05-2025");
    const slash = parseJournalSearch("15/05/2025");
    expect(dash.dateOnly).toBe(true);
    expect(slash.dateOnly).toBe(true);
  });

  it("treats DD.MM.20 as the full 21st century", () => {
    const r = parseJournalSearch("15.05.20");
    expect(r.dateOnly).toBe(true);
    const orList = (r.or[0] as { OR: Array<{ data: { gte: Date } }> }).OR;
    const dates = orList.map((c) => c.data.gte.toISOString().slice(0, 10));
    expect(dates).toContain("2020-05-15");
    expect(dates).toContain("2025-05-15");
    expect(dates).toContain("2030-05-15");
    expect(dates).toContain("2099-05-15");
  });

  it("treats DD.MM.202 as a decade window", () => {
    const r = parseJournalSearch("15.05.202");
    expect(r.dateOnly).toBe(true);
    const orList = (r.or[0] as { OR: Array<{ data: { gte: Date } }> }).OR;
    const dates = orList.map((c) => c.data.gte.toISOString().slice(0, 10));
    expect(dates).toContain("2020-05-15");
    expect(dates).toContain("2025-05-15");
    expect(dates).toContain("2029-05-15");
    expect(dates).not.toContain("2030-05-15");
  });

  it("treats DD.MM.2 (single year-digit) as the full 21st century", () => {
    const r = parseJournalSearch("15.05.2");
    expect(r.dateOnly).toBe(true);
    const orList = (r.or[0] as { OR: Array<{ data: { gte: Date } }> }).OR;
    expect(orList.length).toBeGreaterThan(50);
  });

  it("single-digit day expands to all matching days across years", () => {
    const r = parseJournalSearch("15");
    expect(r.dateOnly).toBe(true);
    const orList = (r.or[0] as { OR: Array<{ data: { gte: Date } }> }).OR;
    expect(orList.length).toBeGreaterThan(100);
  });
});
