import { describe, it, expect } from "vitest";
import {
  buildResolverStateAsOf,
  resolveCategoryForCont,
  type CategoryMappingVersion,
  type CostCategoryNode,
} from "@/modules/categories";
import { periodKey, INCEPTION } from "@/lib/period";

function node(id: string, name: string, parentId: string | null = null): CostCategoryNode {
  return {
    id,
    clientId: "client-1",
    parentId,
    name,
    kind: "expense",
    position: 0,
    isOmfpDefault: false,
    children: [],
    mappingCount: 0,
  };
}

/** Version factory: open (effectiveTo null) unless a window end is given. */
function v(
  cont: string,
  categoryId: string | null,
  effectiveFrom: number,
  effectiveTo: number | null = null,
  scope: "contBase" | "analytic" = "contBase"
): CategoryMappingVersion {
  return { cont, categoryId, scope, effectiveFrom, effectiveTo };
}

const servicii = node("cat-servicii", "Servicii externe");
const outsourcing = node("cat-outsourcing", "Outsourcing");
const tree: CostCategoryNode[] = [servicii, outsourcing];

const at = (versions: CategoryMappingVersion[], y: number, m: number, cont = "628") =>
  resolveCategoryForCont(cont, buildResolverStateAsOf(tree, versions, periodKey(y, m)))?.category
    .id ?? null;

describe("buildResolverStateAsOf — open timeline", () => {
  it("inception version applies to every period (legacy behaviour)", () => {
    const versions = [v("628", "cat-servicii", INCEPTION)];
    expect(at(versions, 2026, 1)).toBe("cat-servicii");
    expect(at(versions, 2026, 12)).toBe("cat-servicii");
  });

  it("switches category from the effective month onward", () => {
    const versions = [
      v("628", "cat-servicii", INCEPTION),
      v("628", "cat-outsourcing", periodKey(2026, 4)),
    ];
    expect(at(versions, 2026, 3)).toBe("cat-servicii");
    expect(at(versions, 2026, 4)).toBe("cat-outsourcing");
    expect(at(versions, 2026, 12)).toBe("cat-outsourcing");
  });

  it("an open tombstone unmaps the cont from its period on", () => {
    const versions = [
      v("628", "cat-servicii", INCEPTION),
      v("628", null, periodKey(2026, 6)),
    ];
    expect(at(versions, 2026, 5)).toBe("cat-servicii");
    expect(at(versions, 2026, 6)).toBeNull();
    expect(at(versions, 2026, 12)).toBeNull();
  });

  it("analytic precedence is preserved within a period", () => {
    const versions = [
      v("628", "cat-servicii", INCEPTION),
      v("628.01", "cat-outsourcing", INCEPTION, null, "analytic"),
    ];
    const state = buildResolverStateAsOf(tree, versions, periodKey(2026, 5));
    expect(resolveCategoryForCont("628.01", state)?.category.id).toBe("cat-outsourcing");
    expect(resolveCategoryForCont("628.02", state)?.category.id).toBe("cat-servicii");
  });

  it("versions effective after the target period are ignored", () => {
    const versions = [v("628", "cat-outsourcing", periodKey(2026, 9))];
    expect(at(versions, 2026, 3)).toBeNull();
  });
});

describe("buildResolverStateAsOf — bounded overrides (D3 two-layer)", () => {
  it("a bounded override wins only inside its window; base resolves outside", () => {
    const versions = [
      v("628", "cat-servicii", INCEPTION),
      v("628", "cat-outsourcing", periodKey(2026, 4), periodKey(2026, 5)),
    ];
    expect(at(versions, 2026, 3)).toBe("cat-servicii");
    expect(at(versions, 2026, 4)).toBe("cat-outsourcing");
    expect(at(versions, 2026, 5)).toBe("cat-outsourcing");
    expect(at(versions, 2026, 6)).toBe("cat-servicii");
  });

  it("editing the base later flows through outside the window (reference-correct)", () => {
    // The open layer is edited from March to Outsourcing; a bounded override
    // pins Servicii only for April. May onward must follow the NEW base.
    const versions = [
      v("628", "cat-servicii", INCEPTION),
      v("628", "cat-outsourcing", periodKey(2026, 3)),
      v("628", "cat-servicii", periodKey(2026, 4), periodKey(2026, 4)),
    ];
    expect(at(versions, 2026, 2)).toBe("cat-servicii"); // inception
    expect(at(versions, 2026, 3)).toBe("cat-outsourcing"); // new base
    expect(at(versions, 2026, 4)).toBe("cat-servicii"); // bounded pin
    expect(at(versions, 2026, 5)).toBe("cat-outsourcing"); // back to new base
  });

  it("a bounded tombstone clears just its window", () => {
    const versions = [
      v("628", "cat-servicii", INCEPTION),
      v("628", null, periodKey(2026, 4), periodKey(2026, 4)),
    ];
    expect(at(versions, 2026, 3)).toBe("cat-servicii");
    expect(at(versions, 2026, 4)).toBeNull();
    expect(at(versions, 2026, 5)).toBe("cat-servicii");
  });
});
