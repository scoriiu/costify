import { describe, it, expect } from "vitest";
import {
  decideImportUpsert,
  filterImportableNames,
} from "@/modules/accounts/import-upsert";
import type { CatalogAccount, ClientAccountRecord } from "@/modules/accounts";

/**
 * D14 contract: on import, new analytic accounts are created automatically.
 * If the account's contBase is not in AccountCatalog, needsReview=true so
 * the UI can flag it for the accountant.
 *
 * Existing rows:
 *   - source="user_edit" → never overwrite name (sticky edit).
 *   - other sources → update name if changed, keep source, keep needsReview.
 *
 * See docs/decisions/0001-plan-de-conturi-refactor.md D14 + D10.
 */

function catalogEntry(code: string, name: string): CatalogAccount {
  return {
    code,
    name,
    type: "B",
    classDigit: parseInt(code[0], 10),
    cppGroup: null,
    cppLabel: null,
    cppLine: null,
    cppLineLabel: null,
    special: null,
    isClosing: false,
    isProfitTax: false,
    isProfitDistribution: false,
    isExtraBilantier: false,
    isIfrsOnly: false,
    cashRole: null,
    arRole: null,
    apRole: null,
    vatRole: null,
    payrollRole: null,
  };
}

function existingEntry(
  code: string,
  customName: string,
  overrides: Partial<ClientAccountRecord> = {}
): ClientAccountRecord {
  return {
    code,
    customName,
    source: "saga_import",
    partnerCode: null,
    needsReview: false,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    ...overrides,
  };
}

const CATALOG_WITH_401 = new Map([["401", catalogEntry("401", "Furnizori")]]);
const EMPTY_CATALOG = new Map<string, CatalogAccount>();

describe("decideImportUpsert — new account (no existing row)", () => {
  it("creates with needsReview=false when contBase is in catalog", () => {
    const d = decideImportUpsert(
      "401.00023",
      "Orange Romania",
      null,
      CATALOG_WITH_401
    );

    expect(d.action).toBe("create");
    expect(d.customName).toBe("Orange Romania");
    expect(d.source).toBe("saga_import");
    expect(d.needsReview).toBe(false);
  });

  it("creates with needsReview=true when contBase is NOT in catalog", () => {
    const d = decideImportUpsert(
      "6588.001",
      "Cheltuieli custom",
      null,
      EMPTY_CATALOG // catalog is empty; 6588 won't be found
    );

    expect(d.action).toBe("create");
    expect(d.needsReview).toBe(true);
  });

  it("creates with needsReview=false when direct code matches (no contBase split)", () => {
    const catalog = new Map([["5121", catalogEntry("5121", "Banca")]]);
    const d = decideImportUpsert("5121", "Banca BT", null, catalog);

    expect(d.action).toBe("create");
    expect(d.needsReview).toBe(false);
  });

  it("trims whitespace from customName", () => {
    const d = decideImportUpsert(
      "401.00023",
      "  Orange Romania  ",
      null,
      CATALOG_WITH_401
    );
    expect(d.customName).toBe("Orange Romania");
  });
});

describe("decideImportUpsert — existing row with user_edit (sticky)", () => {
  it("skips name update when source is user_edit", () => {
    const existing = existingEntry("401.00023", "Orange Romania SA", {
      source: "user_edit",
    });

    const d = decideImportUpsert(
      "401.00023",
      "ORANGE ROM", // Saga gave a different (worse) name
      existing,
      CATALOG_WITH_401
    );

    expect(d.action).toBe("skip_sticky_edit");
    expect(d.customName).toBeNull(); // no change to write
  });
});

describe("decideImportUpsert — existing row with saga_import", () => {
  it("updates name when Saga provides a different one", () => {
    const existing = existingEntry("401.00023", "Orange Rom");

    const d = decideImportUpsert(
      "401.00023",
      "Orange Romania SA",
      existing,
      CATALOG_WITH_401
    );

    expect(d.action).toBe("update_name");
    expect(d.customName).toBe("Orange Romania SA");
    expect(d.source).toBeNull(); // don't change source
    expect(d.needsReview).toBeNull(); // don't change review flag
  });

  it("touches lastSeenAt when name matches (no change)", () => {
    const existing = existingEntry("401.00023", "Orange Romania");

    const d = decideImportUpsert(
      "401.00023",
      "Orange Romania",
      existing,
      CATALOG_WITH_401
    );

    expect(d.action).toBe("touch_last_seen");
  });

  it("preserves needsReview=true on existing row when import sees it again", () => {
    const existing = existingEntry("6588.001", "Custom thing", {
      needsReview: true,
    });

    const d = decideImportUpsert(
      "6588.001",
      "Custom thing NEW",
      existing,
      EMPTY_CATALOG
    );

    expect(d.action).toBe("update_name");
    expect(d.needsReview).toBeNull(); // null = keep existing; UI/DB keeps needsReview=true
  });
});

describe("decideImportUpsert — edge cases", () => {
  it("handles trimming in comparison so whitespace changes aren't considered different", () => {
    const existing = existingEntry("401.00023", "Orange Romania");

    const d = decideImportUpsert(
      "401.00023",
      "  Orange Romania  ", // trimmed = "Orange Romania" = existing
      existing,
      CATALOG_WITH_401
    );

    expect(d.action).toBe("touch_last_seen");
  });
});

describe("filterImportableNames", () => {
  it("drops entries with empty or whitespace names", () => {
    const input = new Map([
      ["401.00023", "Orange Romania"],
      ["401.00024", ""],
      ["401.00025", "   "],
      ["401.00026", "Electrica"],
    ]);

    const result = filterImportableNames(input);
    expect(result.size).toBe(2);
    expect(result.has("401.00023")).toBe(true);
    expect(result.has("401.00026")).toBe(true);
  });

  it("trims whitespace on the remaining entries", () => {
    const input = new Map([["401.00023", "  Orange Romania  "]]);
    const result = filterImportableNames(input);
    expect(result.get("401.00023")).toBe("Orange Romania");
  });

  it("returns empty map when all entries are empty", () => {
    const input = new Map([
      ["401.00023", ""],
      ["401.00024", "  "],
    ]);
    expect(filterImportableNames(input).size).toBe(0);
  });
});
