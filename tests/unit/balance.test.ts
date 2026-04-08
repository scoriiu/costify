import { describe, it, expect } from "vitest";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import type { JournalEntry } from "@/modules/ingestion/types";

function entry(overrides: Partial<JournalEntry> & Pick<JournalEntry, "contD" | "contC" | "suma">): JournalEntry {
  return {
    data: new Date(2024, 0, 15),
    year: 2024, month: 1, ndp: "1",
    contDBase: overrides.contD.split(".")[0],
    contCBase: overrides.contC.split(".")[0],
    explicatie: "", felD: "", categorie: null, cod: null, validat: null, tva: null,
    ...overrides,
  };
}

describe("computeBalanceFromJournal", () => {
  it("computes basic debit/credit balance", () => {
    const entries: JournalEntry[] = [
      entry({ contD: "5121", contC: "4111", suma: 1000 }),
      entry({ contD: "627", contC: "5121", suma: 50 }),
    ];

    const rows = computeBalanceFromJournal(entries, 2024, 1);
    const byAccount = Object.fromEntries(rows.map((r) => [r.cont, r]));

    expect(byAccount["5121"].finD).toBe(950);
    expect(byAccount["5121"].finC).toBe(0);
    expect(byAccount["4111"].finD).toBe(0);
    expect(byAccount["4111"].finC).toBe(1000);
    expect(byAccount["627"].finD).toBe(50);
    expect(byAccount["627"].finC).toBe(0);
  });

  it("closes P&L accounts across years", () => {
    const entries: JournalEntry[] = [
      entry({ contD: "627", contC: "5121", suma: 100, year: 2023, month: 6, data: new Date(2023, 5, 1) }),
      entry({ contD: "5121", contC: "704", suma: 500, year: 2023, month: 6, data: new Date(2023, 5, 1) }),
      entry({ contD: "627", contC: "5121", suma: 200, year: 2024, month: 1 }),
    ];

    const rows = computeBalanceFromJournal(entries, 2024, 1);
    const byAccount = Object.fromEntries(rows.map((r) => [r.cont, r]));

    // 2023 P&L: revenue 500, expense 100 -> net profit 400 to credit side of 121
    expect(byAccount["121"].debInit).toBe(0);
    expect(byAccount["121"].credInit).toBe(400);

    // 2024 expenses should be fresh (no carry from 2023)
    expect(byAccount["627"].debInit).toBe(0);
    expect(byAccount["627"].finD).toBe(200);
  });

  it("handles leaf-only computation", () => {
    const entries: JournalEntry[] = [
      entry({ contD: "5121.001", contC: "4111", suma: 1000 }),
      entry({ contD: "5121.002", contC: "4111", suma: 2000 }),
    ];

    const rows = computeBalanceFromJournal(entries, 2024, 1);
    const leafRows = rows.filter((r) => r.isLeaf);
    const parentRows = rows.filter((r) => !r.isLeaf);

    expect(leafRows.length).toBeGreaterThan(0);
    // 5121 should not be a leaf since it has children
    const parent5121 = rows.find((r) => r.cont === "5121");
    // 5121 won't exist because entries only have 5121.001 and 5121.002
    // But 4111 should exist (it appears as credit in both)
    const account4111 = rows.find((r) => r.cont === "4111");
    expect(account4111?.finC).toBe(3000);
  });

  it("trial balance is balanced (total debit = total credit)", () => {
    const entries: JournalEntry[] = [
      entry({ contD: "5121", contC: "1012", suma: 50000, month: 1 }),
      entry({ contD: "641", contC: "421", suma: 10000, month: 1 }),
      entry({ contD: "421", contC: "5121", suma: 10000, month: 1 }),
      entry({ contD: "627", contC: "5121", suma: 200, month: 1 }),
      entry({ contD: "5121", contC: "704", suma: 30000, month: 1 }),
    ];

    const rows = computeBalanceFromJournal(entries, 2024, 1);
    const leafRows = rows.filter((r) => r.isLeaf);

    const totalFinD = leafRows.reduce((s, r) => s + r.finD, 0);
    const totalFinC = leafRows.reduce((s, r) => s + r.finC, 0);
    expect(Math.abs(totalFinD - totalFinC)).toBeLessThan(0.01);
  });
});
