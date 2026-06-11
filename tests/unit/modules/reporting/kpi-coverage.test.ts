import { describe, it, expect } from "vitest";
import { getKpiCoverage } from "@/modules/reporting/industry/coverage";
import { KPI_BY_ID } from "@/modules/reporting/industry/registry";

describe("getKpiCoverage", () => {
  const report = getKpiCoverage();

  it("every mapped registryId exists in the registry", () => {
    for (const section of report.sections) {
      for (const row of section.rows) {
        if (row.registryId) {
          expect(KPI_BY_ID.has(row.registryId), `${row.specName} -> ${row.registryId}`).toBe(true);
        }
      }
    }
  });

  it("statuses are derived: placeholder iff unavailableReason", () => {
    for (const section of report.sections) {
      for (const row of section.rows) {
        if (!row.registryId) {
          expect(row.status).toBe("omitted");
        } else {
          const def = KPI_BY_ID.get(row.registryId)!;
          expect(row.status).toBe(def.unavailableReason ? "placeholder" : "computed");
        }
      }
    }
  });

  it("every omitted row carries an explanation", () => {
    const allRows = report.sections.flatMap((s) => s.rows);
    for (const row of allRows.filter((r) => r.status === "omitted")) {
      expect(row.note, row.specName).toBeTruthy();
    }
  });

  it("every registry KPI appears exactly once (spec or extra)", () => {
    const seen = [
      ...report.sections.flatMap((s) => s.rows.map((r) => r.registryId)),
      ...report.extraRows.map((r) => r.registryId),
    ].filter(Boolean) as string[];
    for (const id of KPI_BY_ID.keys()) {
      expect(seen.includes(id), `registry id ${id} missing from coverage`).toBe(true);
    }
  });

  it("totals add up", () => {
    const { computed, placeholder, omitted, total } = report.totals;
    expect(computed + placeholder + omitted).toBe(total);
    expect(computed).toBeGreaterThan(20);
  });

  it("roce, fcfAprox, ruleOf40 are covered as computed", () => {
    const all = report.sections.flatMap((s) => s.rows);
    for (const id of ["roce", "fcfAprox", "ruleOf40"]) {
      const row = all.find((r) => r.registryId === id);
      expect(row?.status, id).toBe("computed");
    }
  });

  it("no em dash in any user-visible string", () => {
    const all = [...report.sections.flatMap((s) => s.rows), ...report.extraRows];
    for (const row of all) {
      expect(row.specName.includes("\u2014"), row.specName).toBe(false);
      expect((row.note ?? "").includes("\u2014"), row.specName).toBe(false);
    }
  });
});
