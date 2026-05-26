import { describe, it, expect } from "vitest";
import { EXPENSE_SEEDS, REVENUE_SEEDS } from "@/modules/categories/seed";

describe("OMFP seed definitions (Axa A)", () => {
  it("declares 10 root expense categories", () => {
    expect(EXPENSE_SEEDS).toHaveLength(10);
  });

  it("declares 6 root revenue categories", () => {
    expect(REVENUE_SEEDS).toHaveLength(6);
  });

  it("each root expense category has a 2-digit code", () => {
    for (const seed of EXPENSE_SEEDS) {
      expect(seed.code).toMatch(/^[6-7]\d$/);
    }
  });

  it("each root revenue category has a 2-digit code", () => {
    for (const seed of REVENUE_SEEDS) {
      expect(seed.code).toMatch(/^7\d$/);
    }
  });

  describe("Salarii si contributii decomposition", () => {
    const salarii = EXPENSE_SEEDS.find((s) => s.code === "64");

    it("exists with code 64", () => {
      expect(salarii).toBeDefined();
      expect(salarii?.label).toBe("Salarii si contributii");
    });

    it("has 4 sub-categories", () => {
      expect(salarii?.children).toHaveLength(4);
    });

    it("decomposes into the canonical 641/642/645/646 codes", () => {
      const codes = salarii?.children?.map((c) => c.code).sort();
      expect(codes).toEqual(["641", "642", "645", "646"]);
    });

    it("uses patron-friendly labels for sub-categories", () => {
      const byCode = new Map(
        salarii?.children?.map((c) => [c.code, c.label]) ?? []
      );
      expect(byCode.get("641")).toBe("Salarii brut");
      expect(byCode.get("642")).toBe("Tichete si avantaje in natura");
      expect(byCode.get("645")).toBe("Asigurari sociale (CAS, CASS, somaj)");
      expect(byCode.get("646")).toBe("Ajutoare materiale");
    });

    it("sub-category codes are exactly 3 digits", () => {
      for (const child of salarii?.children ?? []) {
        expect(child.code).toMatch(/^\d{3}$/);
      }
    });
  });

  describe("Non-decomposed categories", () => {
    it("most expense categories have no sub-categories (decomposition is opt-in by class)", () => {
      const withChildren = EXPENSE_SEEDS.filter((s) => s.children && s.children.length > 0);
      expect(withChildren.map((s) => s.code)).toEqual(["64"]);
    });

    it("no revenue category has sub-categories by default", () => {
      const withChildren = REVENUE_SEEDS.filter((s) => s.children && s.children.length > 0);
      expect(withChildren).toHaveLength(0);
    });
  });
});
