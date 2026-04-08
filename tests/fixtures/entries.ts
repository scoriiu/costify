import type { JournalEntry } from "@/modules/ingestion/types";

export function makeEntry(
  overrides: Partial<JournalEntry> & Pick<JournalEntry, "contD" | "contC" | "suma">
): JournalEntry {
  return {
    data: new Date(2024, 0, 15),
    year: 2024,
    month: 1,
    ndp: "1",
    contDBase: overrides.contD.split(".")[0],
    contCBase: overrides.contC.split(".")[0],
    explicatie: "",
    felD: "",
    categorie: null,
    cod: null,
    validat: null,
    tva: null,
    ...overrides,
  };
}

export function makeEntries(
  items: Array<Partial<JournalEntry> & Pick<JournalEntry, "contD" | "contC" | "suma">>
): JournalEntry[] {
  return items.map(makeEntry);
}
