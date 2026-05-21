/**
 * Runs detectTaxRegimeTimeline against every client snapshot in
 * tests/fixtures/reference and prints the detected timeline.
 *
 *   npx tsx scripts/detect-tax-regime.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { detectTaxRegimeTimeline } from "@/modules/clients/tax-regime-detector";
import type { JournalEntry } from "@/modules/ingestion/types";

interface SerializedEntry {
  data: string;
  year: number;
  month: number;
  ndp: string;
  contD: string;
  contDBase: string;
  contC: string;
  contCBase: string;
  suma: number;
  explicatie: string;
  felD: string;
  categorie: string | null;
  cod: string | null;
  validat: string | null;
  tva: number | null;
}

interface Snapshot {
  source: string;
  generatedAt: string;
  totalRaw: number;
  years: number[];
  accountNames: [string, string][];
  entries: SerializedEntry[];
}

function hydrate(snap: Snapshot): JournalEntry[] {
  return snap.entries.map((e) => ({ ...e, data: new Date(e.data) }));
}

function loadSnapshot(file: string): JournalEntry[] {
  const buf = gunzipSync(readFileSync(resolve("tests/fixtures/reference", file)));
  const snap = JSON.parse(buf.toString()) as Snapshot;
  return hydrate(snap);
}

const FIXTURES = [
  "qhm-registru-jurnal.snapshot.json.gz",
  "4walls-kronis-registru-jurnal.snapshot.json.gz",
  "widder-registru-jurnal.snapshot.json.gz",
  "enadri-registru-jurnal.snapshot.json.gz",
  "citibox-registru-jurnal.snapshot.json.gz",
  "titan-registru-jurnal.snapshot.json.gz",
  "medezen-registru-jurnal.snapshot.json.gz",
  "flavus-registru-jurnal.snapshot.json.gz",
  "upperhouse-registru-jurnal.snapshot.json.gz",
  "hello-registru-jurnal.snapshot.json.gz",
  "cs-analytiqs-registru-jurnal.snapshot.json.gz",
  "swat-registru-jurnal.snapshot.json.gz",
  "kluthe-registru-jurnal.snapshot.json.gz",
  "korner-registru-jurnal.snapshot.json.gz",
];

function main() {
  for (const f of FIXTURES) {
    const entries = loadSnapshot(f);
    const tl = detectTaxRegimeTimeline(entries);
    const name = f.replace("-registru-jurnal.snapshot.json.gz", "");
    console.log("\n=== " + name + " (" + entries.length + " entries) ===");
    if (tl.length === 0) {
      console.log("  (no signal)");
      continue;
    }
    for (const t of tl) {
      const date = t.startDate.toISOString().slice(0, 10);
      console.log("  " + date + "  " + t.taxRegime.padEnd(18) + "  conf=" + t.confidence + "  " + t.reason);
      for (const w of t.warnings) console.log("    ! " + w);
    }
  }
}

main();
