import { describe, it, expect } from "vitest";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import type { JournalEntry } from "@/modules/ingestion/types";

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

describe("synthetic parent aggregation in balanta", () => {
  it("creates a parent row that sums two analytics on the same synthetic", () => {
    const d = new Date(2025, 4, 10);
    const entries: JournalEntry[] = [
      entry(d, "401.00001", "5121.BT", 100),
      entry(d, "401.00002", "5121.BT", 250),
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 5);
    const parent401 = rows.find((r) => r.cont === "401");
    expect(parent401).toBeDefined();
    expect(parent401!.rulajTD).toBeCloseTo(350, 2);
    expect(parent401!.hasChild).toBe(true);
    expect(parent401!.isLeaf).toBe(false);

    const a1 = rows.find((r) => r.cont === "401.00001");
    const a2 = rows.find((r) => r.cont === "401.00002");
    expect(a1?.isLeaf).toBe(true);
    expect(a2?.isLeaf).toBe(true);
  });

  it("does not invent a parent when only the synthetic itself is used", () => {
    const d = new Date(2025, 4, 10);
    const entries: JournalEntry[] = [
      entry(d, "5121", "121", 50),
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 5);
    const all = rows.filter((r) => r.cont === "5121");
    expect(all).toHaveLength(1);
    expect(all[0].isLeaf).toBe(true);
    expect(all[0].hasChild).toBe(false);
  });

  it("merges journal usage of the synthetic with its analytics under one parent row", () => {
    const d = new Date(2025, 4, 10);
    const entries: JournalEntry[] = [
      entry(d, "401.00001", "5121.BT", 100),
      entry(d, "401", "5121.BT", 30),
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 5);
    const parents = rows.filter((r) => r.cont === "401");
    expect(parents).toHaveLength(1);
    expect(parents[0].rulajTD).toBeCloseTo(130, 2);
    expect(parents[0].hasChild).toBe(true);
    expect(parents[0].isLeaf).toBe(false);
  });

  it("aggregates compound named analytics like 4428.TI + 4428.TP under 4428", () => {
    const d = new Date(2025, 4, 10);
    const entries: JournalEntry[] = [
      entry(d, "4111.00001", "4428.TI", 19),
      entry(d, "4111.00001", "4428.TP", 19),
    ];

    const rows = computeBalanceFromJournal(entries, 2025, 5);
    const parent = rows.find((r) => r.cont === "4428");
    expect(parent).toBeDefined();
    expect(parent!.rulajTC).toBeCloseTo(38, 2);
  });
});
