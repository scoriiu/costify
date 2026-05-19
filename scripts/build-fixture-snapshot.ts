/**
 * Pre-bakes journal parse output into a JSON snapshot for fast test runs.
 *
 * Usage:  pnpm tsx scripts/build-fixture-snapshot.ts
 *
 * Reads tests/fixtures/reference/qhm-registru-jurnal.xlsx (~2 MB, 17k rows),
 * parses it with the production parser, and emits qhm-entries.json so the
 * verify-against-accountant tests can hydrate entries instantly instead of
 * re-parsing XLSX on every CI run.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { gzipSync } from "zlib";
import { parseJournalXLSX } from "@/modules/ingestion/journal-parser";

const FIXTURES = resolve(__dirname, "../tests/fixtures/reference");

interface SerializableEntry {
  data: string; // ISO
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
  entries: SerializableEntry[];
}

function bake(journalFile: string, outFile: string) {
  const inputPath = resolve(FIXTURES, journalFile);
  const buffer = readFileSync(inputPath);
  console.log(`[bake] reading ${journalFile} (${(buffer.length / 1024).toFixed(1)} KB)`);

  const t0 = Date.now();
  const result = parseJournalXLSX(buffer);
  const parseMs = Date.now() - t0;
  console.log(
    `[bake] parsed ${result.entries.length} entries in ${parseMs} ms (errors: ${result.errors.length})`
  );

  const snapshot: Snapshot = {
    source: journalFile,
    generatedAt: new Date().toISOString(),
    totalRaw: result.totalRaw,
    years: result.years,
    accountNames: [...result.accountNames.entries()],
    entries: result.entries.map((e) => ({
      data: e.data.toISOString(),
      year: e.year,
      month: e.month,
      ndp: e.ndp,
      contD: e.contD,
      contDBase: e.contDBase,
      contC: e.contC,
      contCBase: e.contCBase,
      suma: e.suma,
      explicatie: e.explicatie,
      felD: e.felD,
      categorie: e.categorie,
      cod: e.cod,
      validat: e.validat,
      tva: e.tva,
    })),
  };

  const outPath = resolve(FIXTURES, outFile);
  const json = JSON.stringify(snapshot);
  const gz = gzipSync(Buffer.from(json), { level: 9 });
  writeFileSync(outPath, gz);
  console.log(
    `[bake] wrote ${outFile} (${(gz.length / 1024).toFixed(1)} KB gzipped, ${(json.length / 1024).toFixed(1)} KB raw)`
  );
}

bake("qhm-registru-jurnal.xlsx", "qhm-registru-jurnal.snapshot.json.gz");
bake("4walls-kronis-registru-jurnal.xlsx", "4walls-kronis-registru-jurnal.snapshot.json.gz");
bake("widder-registru-jurnal.xlsx", "widder-registru-jurnal.snapshot.json.gz");
bake("enadri-registru-jurnal.xls", "enadri-registru-jurnal.snapshot.json.gz");
bake("citibox-registru-jurnal.xlsx", "citibox-registru-jurnal.snapshot.json.gz");
bake("titan-registru-jurnal.xlsx", "titan-registru-jurnal.snapshot.json.gz");
bake("medezen-registru-jurnal.xls", "medezen-registru-jurnal.snapshot.json.gz");
bake("flavus-registru-jurnal.xlsx", "flavus-registru-jurnal.snapshot.json.gz");
bake("upperhouse-registru-jurnal.xlsx", "upperhouse-registru-jurnal.snapshot.json.gz");
bake("hello-registru-jurnal.xlsx", "hello-registru-jurnal.snapshot.json.gz");
bake("cs-analytiqs-registru-jurnal.xlsx", "cs-analytiqs-registru-jurnal.snapshot.json.gz");
bake("swat-registru-jurnal.xlsx", "swat-registru-jurnal.snapshot.json.gz");
bake("kluthe-registru-jurnal.xls", "kluthe-registru-jurnal.snapshot.json.gz");
bake("korner-registru-jurnal.xlsx", "korner-registru-jurnal.snapshot.json.gz");
console.log("[bake] done");
