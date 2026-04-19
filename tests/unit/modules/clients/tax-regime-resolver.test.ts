import { describe, it, expect } from "vitest";
import {
  resolveRegimeForPeriod,
  sortTransitionsAsc,
  taxRegimeLabel,
  taxRegimeAccount,
  DEFAULT_TAX_REGIME,
  type TaxRegimeTransition,
} from "@/modules/clients/tax-regime-resolver";

function d(iso: string): Date {
  return new Date(iso);
}

describe("resolveRegimeForPeriod", () => {
  it("returns default when no transitions provided", () => {
    expect(resolveRegimeForPeriod([], 2025, 3)).toBe("profit_standard");
  });

  it("returns fallback when period predates all transitions", () => {
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2024, 12)).toBe(DEFAULT_TAX_REGIME);
  });

  it("respects custom fallback", () => {
    expect(resolveRegimeForPeriod([], 2025, 3, "profit_micro_1")).toBe("profit_micro_1");
  });

  it("uses the single transition when only one exists", () => {
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2020-01-01"), taxRegime: "profit_micro_1" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2025, 6)).toBe("profit_micro_1");
  });

  it("picks the most recent transition <= last day of the month", () => {
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2022-01-01"), taxRegime: "profit_micro_1" },
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
    ];
    // Before 2025-01: micro
    expect(resolveRegimeForPeriod(transitions, 2024, 12)).toBe("profit_micro_1");
    // From 2025-01 onwards: standard
    expect(resolveRegimeForPeriod(transitions, 2025, 1)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2025, 6)).toBe("profit_standard");
    // Before first transition: fallback
    expect(resolveRegimeForPeriod(transitions, 2021, 6)).toBe(DEFAULT_TAX_REGIME);
  });

  it("handles mid-month start dates", () => {
    // Transition starts April 15 — April report includes it (last day of April is 30)
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2025-04-15"), taxRegime: "profit_micro_1" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2025, 3)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2025, 4)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2025, 5)).toBe("profit_micro_1");
  });

  it("handles first-of-month start date", () => {
    // April 1 transition — April period picks it up
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2025-04-01"), taxRegime: "profit_micro_1" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2025, 3)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2025, 4)).toBe("profit_micro_1");
  });

  it("handles last-of-month start date", () => {
    // April 30 transition — still within April, so April picks it up
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2025-04-30"), taxRegime: "profit_micro_1" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2025, 4)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2025, 3)).toBe("profit_standard");
  });

  it("handles many transitions across years", () => {
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2020-01-01"), taxRegime: "profit_micro_1" },
      { startDate: d("2022-07-01"), taxRegime: "profit_standard" },
      { startDate: d("2024-01-01"), taxRegime: "imca" },
      { startDate: d("2024-10-01"), taxRegime: "profit_micro_3" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2020, 1)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2022, 6)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2022, 7)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2023, 12)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2024, 1)).toBe("imca");
    expect(resolveRegimeForPeriod(transitions, 2024, 9)).toBe("imca");
    expect(resolveRegimeForPeriod(transitions, 2024, 10)).toBe("profit_micro_3");
    expect(resolveRegimeForPeriod(transitions, 2025, 12)).toBe("profit_micro_3");
  });

  it("handles unordered input", () => {
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2022-01-01"), taxRegime: "profit_micro_1" },
      { startDate: d("2024-06-01"), taxRegime: "imca" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2023, 3)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2024, 5)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2024, 6)).toBe("imca");
    expect(resolveRegimeForPeriod(transitions, 2025, 6)).toBe("profit_standard");
  });

  it("throws on invalid month", () => {
    expect(() => resolveRegimeForPeriod([], 2025, 0)).toThrow();
    expect(() => resolveRegimeForPeriod([], 2025, 13)).toThrow();
    expect(() => resolveRegimeForPeriod([], 2025, -1)).toThrow();
  });

  it("handles Romanian fiscal year transitions (typical real-world case)", () => {
    // Firma a fost pe profit, trece pe micro de la 1 ian 2026 cand a scazut sub plafon
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2022-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2026-01-01"), taxRegime: "profit_micro_1" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2025, 12)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2026, 1)).toBe("profit_micro_1");
  });

  it("handles mid-year transition (Q2 switch)", () => {
    // Firma depaseste plafonul 500k EUR in Q1 -> trece pe profit de la 1 aprilie
    const transitions: TaxRegimeTransition[] = [
      { startDate: d("2023-01-01"), taxRegime: "profit_micro_1" },
      { startDate: d("2025-04-01"), taxRegime: "profit_standard" },
    ];
    expect(resolveRegimeForPeriod(transitions, 2025, 3)).toBe("profit_micro_1");
    expect(resolveRegimeForPeriod(transitions, 2025, 4)).toBe("profit_standard");
    expect(resolveRegimeForPeriod(transitions, 2025, 12)).toBe("profit_standard");
  });
});

describe("sortTransitionsAsc", () => {
  it("returns empty array for empty input", () => {
    expect(sortTransitionsAsc([])).toEqual([]);
  });

  it("sorts by startDate ascending", () => {
    const input: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2022-01-01"), taxRegime: "profit_micro_1" },
      { startDate: d("2024-06-01"), taxRegime: "imca" },
    ];
    const sorted = sortTransitionsAsc(input);
    expect(sorted.map((t) => t.taxRegime)).toEqual([
      "profit_micro_1",
      "imca",
      "profit_standard",
    ]);
  });

  it("does not mutate the input", () => {
    const input: TaxRegimeTransition[] = [
      { startDate: d("2025-01-01"), taxRegime: "profit_standard" },
      { startDate: d("2022-01-01"), taxRegime: "profit_micro_1" },
    ];
    const before = input.map((t) => t.startDate.toISOString());
    sortTransitionsAsc(input);
    const after = input.map((t) => t.startDate.toISOString());
    expect(after).toEqual(before);
  });
});

describe("taxRegimeLabel", () => {
  it("returns Romanian labels", () => {
    expect(taxRegimeLabel("profit_standard")).toBe("Impozit pe profit (16%)");
    expect(taxRegimeLabel("profit_micro_1")).toBe("Microintreprindere 1%");
    expect(taxRegimeLabel("profit_micro_3")).toBe("Microintreprindere 3%");
    expect(taxRegimeLabel("imca")).toBe("Impozit minim (IMCA)");
    expect(taxRegimeLabel("profit_specific")).toBe("Impozit specific (HoReCa)");
    expect(taxRegimeLabel("deferred")).toBe("Impozit amanat");
  });
});

describe("taxRegimeAccount", () => {
  it("returns the tax account for each regime", () => {
    expect(taxRegimeAccount("profit_standard")).toBe("691");
    expect(taxRegimeAccount("profit_micro_1")).toBe("698");
    expect(taxRegimeAccount("profit_micro_3")).toBe("698");
    expect(taxRegimeAccount("deferred")).toBe("698");
    expect(taxRegimeAccount("profit_specific")).toBe("695");
    expect(taxRegimeAccount("imca")).toBe("697");
  });
});
