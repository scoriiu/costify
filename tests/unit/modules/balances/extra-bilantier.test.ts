import { describe, it, expect } from "vitest";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import { isExtraBilantierCode } from "@/modules/accounts/flags";
import type { JournalEntry } from "@/modules/ingestion/types";

/**
 * D11 contract tests: class 8/9 accounts are memorandum (extra-bilantier).
 *
 * They must:
 *   - Appear in Balanta de Verificare (visibility preserved)
 *   - Be EXCLUDED from balance totals (bilant doesn't count them)
 *   - Be EXCLUDED from CPP (no cppGroup ensures this)
 *   - Be EXCLUDED from KPIs (KPI formulas filter by isExtraBilantier)
 *
 * See docs/decisions/0001-plan-de-conturi-refactor.md D11.
 */

function entry(
  data: Date,
  contD: string,
  contC: string,
  suma: number
): JournalEntry {
  return {
    data,
    year: data.getFullYear(),
    month: data.getMonth() + 1,
    ndp: "",
    contD,
    contDBase: contD.split(".")[0],
    contC,
    contCBase: contC.split(".")[0],
    suma,
    explicatie: "",
    felD: "",
    categorie: null,
    cod: null,
    validat: null,
    tva: null,
  };
}

describe("D11 — Extra-bilantier accounts in balance", () => {
  it("class 8 accounts appear in balance rows (visibility)", () => {
    const entries = [
      entry(new Date("2025-01-15"), "5121", "4111", 1000),
      entry(new Date("2025-01-20"), "8033", "999", 50000), // extra-bilantier entry
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 1);
    const cont8033 = rows.find((r) => r.cont === "8033");
    expect(cont8033).toBeDefined();
    expect(cont8033?.rulajD).toBe(50000);
  });

  it("class 9 accounts appear in balance rows", () => {
    const entries = [
      entry(new Date("2025-01-15"), "921", "931", 30000),
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 1);
    expect(rows.find((r) => r.cont === "921")).toBeDefined();
    expect(rows.find((r) => r.cont === "931")).toBeDefined();
  });

  it("isExtraBilantier flag correctly identifies class 8/9 bases", () => {
    expect(isExtraBilantierCode("801")).toBe(true);
    expect(isExtraBilantierCode("8033")).toBe(true);
    expect(isExtraBilantierCode("921")).toBe(true);
    expect(isExtraBilantierCode("999")).toBe(true);

    expect(isExtraBilantierCode("101")).toBe(false);
    expect(isExtraBilantierCode("5121")).toBe(false);
    expect(isExtraBilantierCode("706")).toBe(false);
  });

  it("class 8/9 entries keep rulaj counts but don't affect real balance equations", () => {
    // The double-entry in class 8/9 is technically balanced (921 = 931),
    // but it's not real money. Totals for bilant should ignore it.
    const entries = [
      entry(new Date("2025-01-15"), "5121", "4111", 1000), // real: cash in from customer
      entry(new Date("2025-01-20"), "8033", "999", 50000), // memo
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 1);

    // Real accounts
    const r5121 = rows.find((r) => r.cont === "5121");
    const r4111 = rows.find((r) => r.cont === "4111");
    expect(r5121?.finD).toBe(1000);
    expect(r4111?.finC).toBe(1000);

    // Extra-bilantier: same logic applies mechanically, but the KPI/bilant
    // layer is responsible for excluding them.
    const r8033 = rows.find((r) => r.cont === "8033");
    expect(r8033?.finD).toBe(50000);
  });
});
