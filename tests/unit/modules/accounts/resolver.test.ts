import { describe, it, expect } from "vitest";
import { resolveFromMaps } from "@/modules/accounts";
import type { CatalogAccount, ClientAccountRecord } from "@/modules/accounts";

function catalogEntry(
  code: string,
  name: string,
  overrides: Partial<CatalogAccount> = {}
): CatalogAccount {
  return {
    code,
    name,
    type: "B",
    classDigit: parseInt(code.charAt(0), 10),
    cppGroup: null,
    cppLabel: null,
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
    ...overrides,
  };
}

function clientEntry(
  code: string,
  customName: string,
  source: "user_edit" | "saga_import" = "saga_import"
): ClientAccountRecord {
  return {
    code,
    customName,
    source,
    partnerCode: null,
    needsReview: false,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  };
}

describe("resolveFromMaps", () => {
  it("prefers exact client account match", () => {
    const clients = new Map([["401.00023", clientEntry("401.00023", "Orange Romania")]]);
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("401.00023", clients, catalog);
    expect(result.name).toBe("Orange Romania");
    expect(result.unmapped).toBe(false);
    expect(result.source).toBe("client_import");
  });

  it("marks user_edit source separately", () => {
    const clients = new Map([
      ["401.00023", clientEntry("401.00023", "Orange Romania SA", "user_edit")],
    ]);
    const catalog = new Map<string, CatalogAccount>();

    const result = resolveFromMaps("401.00023", clients, catalog);
    expect(result.source).toBe("client_edit");
  });

  it("falls back to catalog exact match", () => {
    const clients = new Map<string, ClientAccountRecord>();
    const catalog = new Map([["5121", catalogEntry("5121", "Conturi la banci in lei")]]);

    const result = resolveFromMaps("5121", clients, catalog);
    expect(result.name).toBe("Conturi la banci in lei");
    expect(result.source).toBe("omfp_catalog");
  });

  it("falls back to catalog base (strip dot suffix)", () => {
    const clients = new Map<string, ClientAccountRecord>();
    const catalog = new Map([["5121", catalogEntry("5121", "Conturi la banci in lei")]]);

    const result = resolveFromMaps("5121.00001", clients, catalog);
    expect(result.name).toBe("Conturi la banci in lei");
    expect(result.source).toBe("omfp_catalog");
  });

  it("falls back to catalog shorter prefix", () => {
    const clients = new Map<string, ClientAccountRecord>();
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("4019", clients, catalog);
    expect(result.name).toBe("Furnizori");
  });

  it("marks unknown account as unmapped", () => {
    const clients = new Map<string, ClientAccountRecord>();
    const catalog = new Map<string, CatalogAccount>();

    const result = resolveFromMaps("9999", clients, catalog);
    expect(result.unmapped).toBe(true);
    expect(result.name).toBe("Cont 9999");
    expect(result.source).toBe("fallback");
  });

  it("client account takes priority over catalog even when both match exact", () => {
    const clients = new Map([["401", clientEntry("401", "Furnizori Custom", "user_edit")]]);
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("401", clients, catalog);
    expect(result.name).toBe("Furnizori Custom");
    expect(result.source).toBe("client_edit");
  });
});

describe("resolveFromMaps — partner name priority (3.4 + D10)", () => {
  it("uses partner name for analytic when no ClientAccount exists", () => {
    const partners = new Map([["401.00023", "Orange Romania"]]);
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("401.00023", new Map(), catalog, partners);
    expect(result.name).toBe("Orange Romania");
    expect(result.source).toBe("partner_extract");
  });

  it("partner name wins over Saga-imported ClientAccount name", () => {
    // Saga set "Furnizori" (base), partner extraction found "Orange Romania"
    const clients = new Map([["401.00023", clientEntry("401.00023", "Furnizori", "saga_import")]]);
    const partners = new Map([["401.00023", "Orange Romania"]]);
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("401.00023", clients, catalog, partners);
    expect(result.name).toBe("Orange Romania");
    expect(result.source).toBe("partner_extract");
  });

  it("user_edit still beats partner — sticky edits are sacred", () => {
    const clients = new Map([["401.00023", clientEntry("401.00023", "Orange RO Principal", "user_edit")]]);
    const partners = new Map([["401.00023", "Orange Romania"]]);
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("401.00023", clients, catalog, partners);
    expect(result.name).toBe("Orange RO Principal");
    expect(result.source).toBe("client_edit");
  });

  it("falls through to Saga ClientAccount when partner missing", () => {
    const clients = new Map([["401.00023", clientEntry("401.00023", "Custom Saga Name")]]);
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);

    const result = resolveFromMaps("401.00023", clients, catalog, new Map());
    expect(result.name).toBe("Custom Saga Name");
    expect(result.source).toBe("client_import");
  });

  it("omitted partner map behaves identically to empty map", () => {
    const catalog = new Map([["401", catalogEntry("401", "Furnizori")]]);
    // No partnerNames arg at all
    const result = resolveFromMaps("401.00023", new Map(), catalog);
    expect(result.name).toBe("Furnizori");
    expect(result.source).toBe("omfp_catalog");
  });
});
