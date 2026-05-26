import { describe, it, expect } from "vitest";
import { normalizePartnerName } from "@/lib/partner-normalize";

describe("normalizePartnerName", () => {
  it("returns empty string for null / undefined / empty", () => {
    expect(normalizePartnerName(null)).toBe("");
    expect(normalizePartnerName(undefined)).toBe("");
    expect(normalizePartnerName("")).toBe("");
    expect(normalizePartnerName("   ")).toBe("");
  });

  it("lowercases the input", () => {
    expect(normalizePartnerName("OMV PETROM")).toBe("omv petrom");
  });

  it("collapses the same partner across casing + spacing variants", () => {
    const variants = [
      "FAN COURIER SRL",
      "Fan Courier SRL",
      "Fan Courier  SRL",
      "fan courier srl",
      "Fan Courier S.R.L.",
      "FAN COURIER s.r.l.",
    ];
    const expected = "fan courier";
    for (const v of variants) {
      expect(normalizePartnerName(v)).toBe(expected);
    }
  });

  it("strips Romanian legal forms anywhere they appear as standalone tokens", () => {
    expect(normalizePartnerName("ALPHA BANK SA")).toBe("alpha bank");
    expect(normalizePartnerName("Alfa PFA")).toBe("alfa");
    expect(normalizePartnerName("Beta SNC")).toBe("beta");
    expect(normalizePartnerName("Gamma SCA")).toBe("gamma");
    expect(normalizePartnerName("Delta SCS")).toBe("delta");
    expect(normalizePartnerName("Epsilon II")).toBe("epsilon");
    expect(normalizePartnerName("Zeta IF")).toBe("zeta");
    expect(normalizePartnerName("SRL-D Eta")).toBe("eta");
  });

  it("strips foreign legal forms too", () => {
    expect(normalizePartnerName("Microsoft LTD")).toBe("microsoft");
    expect(normalizePartnerName("Siemens GmbH")).toBe("siemens");
    expect(normalizePartnerName("Apple Inc.")).toBe("apple");
  });

  it("does NOT strip a legal-form sequence that is part of a word", () => {
    // "DESCRL" should not become "DE" — "SRL" is only stripped as its own
    // token. Here "DESCRL" is one token and "scrl" doesn't match the legal-
    // form set.
    expect(normalizePartnerName("DESCRL Solutions")).toBe("descrl solutions");
    // "IIS" must survive — only the bare token "ii" is dropped.
    expect(normalizePartnerName("IIS Corp")).toBe("iis corp");
  });

  it("strips punctuation, including Romanian-specific dashes and dots", () => {
    expect(normalizePartnerName("CEC Bank-Sucursala")).toBe("cec bank sucursala");
    expect(normalizePartnerName("S.C. ALFA S.R.L.")).toBe("alfa");
    expect(normalizePartnerName("BCR · Sucursala 1")).toBe("bcr sucursala 1");
  });

  it("collapses consecutive whitespace into one space", () => {
    expect(normalizePartnerName("FAN     COURIER     SRL")).toBe("fan courier");
    expect(normalizePartnerName("\tFAN COURIER\nSRL")).toBe("fan courier");
  });

  it("preserves diacritics so semantically different partners stay distinct", () => {
    // Conservative: we don't strip ă, ș, ț, î, â. If the user has two slightly
    // different spellings, they resolve it themselves rather than silently
    // collapse to one partner.
    expect(normalizePartnerName("Țiriac Imobiliare")).toBe("țiriac imobiliare");
    expect(normalizePartnerName("Tiriac Imobiliare")).toBe("tiriac imobiliare");
  });

  it("keeps numbers in the name", () => {
    expect(normalizePartnerName("Carrefour Romania 2025")).toBe(
      "carrefour romania 2025"
    );
    expect(normalizePartnerName("Auchan No. 3")).toBe("auchan no 3");
  });

  it("realistic gas station variants collapse to one key", () => {
    expect(normalizePartnerName("OMV PETROM MARKETING SRL")).toBe(
      "omv petrom marketing"
    );
    expect(normalizePartnerName("OMV Petrom Marketing  S.R.L.")).toBe(
      "omv petrom marketing"
    );
    expect(normalizePartnerName("omv petrom marketing srl")).toBe(
      "omv petrom marketing"
    );
  });

  it("two genuinely different partners stay different", () => {
    expect(normalizePartnerName("ALPHA BANK SRL")).not.toBe(
      normalizePartnerName("BETA BANK SRL")
    );
    expect(normalizePartnerName("Carrefour SA")).not.toBe(
      normalizePartnerName("Auchan SA")
    );
  });

  it("idempotent — normalizing twice gives the same result", () => {
    const input = "  Fan Courier  S.R.L. ";
    const once = normalizePartnerName(input);
    expect(normalizePartnerName(once)).toBe(once);
  });
});
