import { describe, it, expect } from "vitest";
import { normalizeCui, parseAnafEntry } from "@/modules/integrations/anaf";

describe("normalizeCui", () => {
  it("strips RO prefix, spaces and punctuation", () => {
    expect(normalizeCui("RO31679778")).toBe(31679778);
    expect(normalizeCui("ro 31679778")).toBe(31679778);
    expect(normalizeCui(" 31.679.778 ")).toBe(31679778);
    expect(normalizeCui("31679778")).toBe(31679778);
  });

  it("rejects implausible input", () => {
    expect(normalizeCui("")).toBeNull();
    expect(normalizeCui(null)).toBeNull();
    expect(normalizeCui("abc")).toBeNull();
    expect(normalizeCui("1")).toBeNull();
    expect(normalizeCui("12345678901")).toBeNull();
    expect(normalizeCui("0")).toBeNull();
  });
});

describe("parseAnafEntry", () => {
  const fullEntry = {
    date_generale: {
      cui: 31679778,
      denumire: "QHM21 NETWORK S.R.L.",
      cod_CAEN: "7820",
      nrRegCom: "J2013000810087",
      adresa: "JUD. BRASOV, MUN. BRASOV",
      telefon: "0700000000",
      codPostal: "500079",
      stare_inregistrare: "INREGISTRAT din data 22.05.2013",
      forma_juridica: "SOCIETATE COMERCIALA CU RASPUNDERE LIMITATA",
      statusRO_e_Factura: true,
    },
    inregistrare_scop_Tva: { scpTVA: true },
    stare_inactiv: { statusInactivi: false },
  };

  it("maps all fields", () => {
    const parsed = parseAnafEntry(fullEntry, "2026-06-11");
    expect(parsed).not.toBeNull();
    expect(parsed!.denumire).toBe("QHM21 NETWORK S.R.L.");
    expect(parsed!.caen).toBe("7820");
    expect(parsed!.nrRegCom).toBe("J2013000810087");
    expect(parsed!.platitorTva).toBe(true);
    expect(parsed!.eFactura).toBe(true);
    expect(parsed!.inactiv).toBe(false);
    expect(parsed!.dataInterogare).toBe("2026-06-11");
  });

  it("handles missing optional fields", () => {
    const parsed = parseAnafEntry(
      { date_generale: { cui: 123456, denumire: "TEST SRL" } },
      "2026-06-11"
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.caen).toBeNull();
    expect(parsed!.adresa).toBeNull();
    expect(parsed!.platitorTva).toBe(false);
    expect(parsed!.inactiv).toBe(false);
  });

  it("returns null without denumire or cui", () => {
    expect(parseAnafEntry({}, "2026-06-11")).toBeNull();
    expect(parseAnafEntry({ date_generale: { cui: 123 } }, "2026-06-11")).toBeNull();
    expect(parseAnafEntry({ date_generale: { denumire: "X SRL" } }, "2026-06-11")).toBeNull();
  });

  it("flags inactive companies", () => {
    const parsed = parseAnafEntry(
      {
        date_generale: { cui: 99, denumire: "INACTIV SRL" },
        stare_inactiv: { statusInactivi: true },
      },
      "2026-06-11"
    );
    expect(parsed!.inactiv).toBe(true);
  });
});
