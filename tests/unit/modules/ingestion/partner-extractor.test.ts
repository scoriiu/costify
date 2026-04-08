import { describe, it, expect } from "vitest";
import { extractPartnerName, buildPartnerMappings } from "@/modules/ingestion/partner-extractor";
import { makeEntry } from "@tests/fixtures/entries";

describe("extractPartnerName", () => {
  it("extracts SRL partner from description", () => {
    expect(extractPartnerName("PLATA ORANGE ROMANIA SRL NR 12345")).toBe(
      "ORANGE ROMANIA SRL"
    );
  });

  it("extracts SA partner", () => {
    const result = extractPartnerName("ACHIT. ENEL ENERGIE SA FACT 9876");
    expect(result).toBe("ENEL ENERGIE SA");
  });

  it("extracts PFA partner", () => {
    expect(extractPartnerName("PLATA IONESCU MARIA PFA NR 001")).toBe(
      "IONESCU MARIA PFA"
    );
  });

  it("strips payment prefixes", () => {
    expect(extractPartnerName("ACHITARE DEDEMAN SRL CUI 12345")).toBe(
      "DEDEMAN SRL"
    );
  });

  it("strips INCASARE prefix", () => {
    const result = extractPartnerName("INCASARE ROCHE DIAGNOSTICS SRL FACT 100");
    expect(result).toBe("ROCHE DIAGNOSTICS SRL");
  });

  it("returns null for empty string", () => {
    expect(extractPartnerName("")).toBeNull();
  });

  it("returns null for accounting operations without partner", () => {
    expect(extractPartnerName("INCHIDERE LUNA MARTIE")).toBeNull();
  });

  it("truncates at document identifiers (NR, CUI, IBAN)", () => {
    const result = extractPartnerName("ORANGE ROMANIA SRL NR FACT 12345 CUI RO12345678");
    expect(result).toBe("ORANGE ROMANIA SRL");
  });

  it("returns null for single-word descriptions", () => {
    expect(extractPartnerName("STORNO")).toBeNull();
  });
});

describe("buildPartnerMappings", () => {
  it("maps analytic accounts to partner names", () => {
    const entries = [
      makeEntry({ contD: "401.00023", contC: "5121", suma: 1000, explicatie: "PLATA ORANGE ROMANIA SRL" }),
      makeEntry({ contD: "401.00023", contC: "5121", suma: 500, explicatie: "PLATA ORANGE ROMANIA SRL" }),
    ];

    const mappings = buildPartnerMappings(entries);
    expect(mappings.length).toBe(1);
    expect(mappings[0].analyticAccount).toBe("401.00023");
    expect(mappings[0].contBase).toBe("401");
    expect(mappings[0].partnerName).toBe("ORANGE ROMANIA SRL");
  });

  it("picks most frequent name for an account", () => {
    const entries = [
      makeEntry({ contD: "401.00001", contC: "5121", suma: 100, explicatie: "PLATA DEDEMAN SRL" }),
      makeEntry({ contD: "401.00001", contC: "5121", suma: 200, explicatie: "PLATA DEDEMAN SRL" }),
      makeEntry({ contD: "401.00001", contC: "5121", suma: 50, explicatie: "ACHIT DEDEMAN S.R.L." }),
    ];

    const mappings = buildPartnerMappings(entries);
    expect(mappings[0].partnerName).toBe("DEDEMAN SRL");
  });

  it("extracts partners from both debit and credit sides", () => {
    const entries = [
      makeEntry({ contD: "5121", contC: "411.001", suma: 5000, explicatie: "INCASARE ROCHE DIAGNOSTICS SRL" }),
    ];

    const mappings = buildPartnerMappings(entries);
    expect(mappings.length).toBe(1);
    expect(mappings[0].analyticAccount).toBe("411.001");
    expect(mappings[0].contBase).toBe("411");
  });

  it("ignores non-partner accounts", () => {
    const entries = [
      makeEntry({ contD: "641", contC: "421", suma: 10000, explicatie: "SALARII LUNA MARTIE" }),
    ];

    const mappings = buildPartnerMappings(entries);
    expect(mappings.length).toBe(0);
  });

  it("returns sorted by analytic account", () => {
    const entries = [
      makeEntry({ contD: "401.00050", contC: "5121", suma: 100, explicatie: "PLATA EMAG SRL" }),
      makeEntry({ contD: "401.00010", contC: "5121", suma: 100, explicatie: "PLATA DEDEMAN SRL" }),
    ];

    const mappings = buildPartnerMappings(entries);
    expect(mappings[0].analyticAccount).toBe("401.00010");
    expect(mappings[1].analyticAccount).toBe("401.00050");
  });
});
