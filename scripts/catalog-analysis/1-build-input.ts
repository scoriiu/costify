#!/usr/bin/env tsx
/**
 * Catalog analysis — step 1: assemble the input bundle for Costi.
 *
 * Sources of truth we feed into the analysis:
 *   - seeds/omfp-1802.json  → current catalog (324 accounts)
 *   - docs/20260515/Plan_conturi_202604.xlsx → official Saga plan (583 accounts)
 *   - production DocAnswer table → Claudia's 38 answers
 *   - production JournalLine.contDBase + contCBase → real accounts used by
 *     existing clients, with a flag for those currently missing from catalog
 *
 * Output: temp/catalog-delta-input.json
 *
 * No mutations. Read-only on prod DB. Safe to re-run any time.
 *
 * Usage:
 *   npx tsx scripts/catalog-analysis/1-build-input.ts
 *
 * Production DB connection: assumes DATABASE_URL points at the cluster
 * postgres via port-forward, or the script will use the local DB if that's
 * what DATABASE_URL points at. Either way it's read-only.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OUTPUT_PATH = join(ROOT, "temp", "catalog-delta-input.json");

interface SeedAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
  cppGroup?: string | null;
  cppLabel?: string | null;
  cppLine?: string | null;
  cppLineLabel?: string | null;
  isClosing?: boolean;
  isProfitTax?: boolean;
  isProfitDistribution?: boolean;
  isExtraBilantier?: boolean;
  cashRole?: string | null;
  arRole?: string | null;
  apRole?: string | null;
  vatRole?: string | null;
  payrollRole?: string | null;
}

interface SagaAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
}

interface DocAnswer {
  docSlug: string;
  sectionId: string;
  sectionText: string;
  content: string;
  updatedAt: string;
}

interface JournalAccountUsage {
  contBase: string;
  occurrences: number;
  inSeed: boolean;
  inSaga: boolean;
  sampleClientNames: string[];
  sampleExplicatii: string[];
}

function loadSeed(): SeedAccount[] {
  const raw = readFileSync(join(ROOT, "seeds", "omfp-1802.json"), "utf-8");
  const parsed = JSON.parse(raw) as { accounts: SeedAccount[] };
  return parsed.accounts;
}

function loadSagaPlan(): SagaAccount[] {
  const wb = XLSX.readFile(join(ROOT, "docs", "20260515", "Plan_conturi_202604.xlsx"));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });

  return rows
    .slice(1)
    .filter((r) => r[0] && String(r[0]).trim() !== "")
    .map((r) => ({
      code: String(r[0]).trim(),
      name: String(r[1]).trim(),
      type: String(r[2]).trim().toUpperCase() as "A" | "P" | "B",
    }))
    .filter((a) => a.code.length > 0 && ["A", "P", "B"].includes(a.type));
}

async function loadDocAnswers(prisma: PrismaClient): Promise<DocAnswer[]> {
  const rows = await prisma.docAnswer.findMany({
    where: {
      docSlug: {
        in: [
          "intrebari-contabil-plan-conturi",
          "intrebari-contabil-f20-detaliat",
          "intrebari-contabil-conturi-nemapate",
        ],
      },
    },
    orderBy: [{ docSlug: "asc" }, { sectionId: "asc" }],
    select: {
      docSlug: true,
      sectionId: true,
      sectionText: true,
      content: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}

async function loadJournalAccountUsage(
  prisma: PrismaClient,
  seed: SeedAccount[],
  saga: SagaAccount[]
): Promise<JournalAccountUsage[]> {
  const seedCodes = new Set(seed.map((a) => a.code));
  const sagaCodes = new Set(saga.map((a) => a.code));

  const debitGroup = await prisma.journalLine.groupBy({
    by: ["contDBase"],
    where: { deletedAt: null },
    _count: { contDBase: true },
  });
  const creditGroup = await prisma.journalLine.groupBy({
    by: ["contCBase"],
    where: { deletedAt: null },
    _count: { contCBase: true },
  });

  const occurrencesByBase = new Map<string, number>();
  for (const g of debitGroup) {
    if (!g.contDBase) continue;
    occurrencesByBase.set(g.contDBase, (occurrencesByBase.get(g.contDBase) ?? 0) + g._count.contDBase);
  }
  for (const g of creditGroup) {
    if (!g.contCBase) continue;
    occurrencesByBase.set(g.contCBase, (occurrencesByBase.get(g.contCBase) ?? 0) + g._count.contCBase);
  }

  const allBases = Array.from(occurrencesByBase.keys()).sort();

  const usage: JournalAccountUsage[] = [];
  for (const base of allBases) {
    const occurrences = occurrencesByBase.get(base) ?? 0;
    const inSeed = seedCodes.has(base);
    const inSaga = sagaCodes.has(base);

    const sample = await prisma.journalLine.findMany({
      where: {
        deletedAt: null,
        OR: [{ contDBase: base }, { contCBase: base }],
      },
      select: { explicatie: true, client: { select: { name: true } } },
      take: 3,
      distinct: ["explicatie"],
    });

    usage.push({
      contBase: base,
      occurrences,
      inSeed,
      inSaga,
      sampleClientNames: Array.from(new Set(sample.map((s) => s.client.name))).slice(0, 3),
      sampleExplicatii: Array.from(new Set(sample.map((s) => s.explicatie).filter(Boolean))).slice(0, 3),
    });
  }
  return usage;
}

function computeNameMismatches(
  seed: SeedAccount[],
  saga: SagaAccount[]
): Array<{ code: string; seedName: string; sagaName: string; seedType: string; sagaType: string }> {
  const sagaByCode = new Map(saga.map((a) => [a.code, a]));
  const mismatches: Array<{
    code: string;
    seedName: string;
    sagaName: string;
    seedType: string;
    sagaType: string;
  }> = [];
  for (const s of seed) {
    const sagaEntry = sagaByCode.get(s.code);
    if (!sagaEntry) continue;
    const seedNormalized = s.name.toLowerCase().replace(/\s+/g, " ").trim();
    const sagaNormalized = sagaEntry.name.toLowerCase().replace(/\s+/g, " ").trim();
    const typeMatch = s.type === sagaEntry.type;
    const nameSimilar = seedNormalized === sagaNormalized;
    if (!nameSimilar || !typeMatch) {
      mismatches.push({
        code: s.code,
        seedName: s.name,
        sagaName: sagaEntry.name,
        seedType: s.type,
        sagaType: sagaEntry.type,
      });
    }
  }
  return mismatches;
}

function computeMissingFromSeed(
  seed: SeedAccount[],
  saga: SagaAccount[]
): SagaAccount[] {
  const seedCodes = new Set(seed.map((a) => a.code));
  return saga.filter((a) => !seedCodes.has(a.code));
}

function computeMissingFromSaga(
  seed: SeedAccount[],
  saga: SagaAccount[]
): SeedAccount[] {
  const sagaCodes = new Set(saga.map((a) => a.code));
  return seed.filter((a) => !sagaCodes.has(a.code));
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Loading seeds/omfp-1802.json...");
    const seed = loadSeed();
    console.log(`  → ${seed.length} accounts in seed`);

    console.log("Loading Plan_conturi_202604.xlsx...");
    const saga = loadSagaPlan();
    console.log(`  → ${saga.length} accounts in Saga export`);

    console.log("Loading DocAnswer from DB...");
    const answers = await loadDocAnswers(prisma);
    console.log(`  → ${answers.length} answers from Claudia`);

    console.log("Loading journal usage from DB (real client data)...");
    const usage = await loadJournalAccountUsage(prisma, seed, saga);
    const unmappedInProd = usage.filter((u) => !u.inSeed);
    console.log(`  → ${usage.length} distinct contBase across all clients`);
    console.log(`  → ${unmappedInProd.length} of those are NOT in current seed`);

    console.log("Computing seed-vs-saga deltas...");
    const mismatches = computeNameMismatches(seed, saga);
    const missingFromSeed = computeMissingFromSeed(seed, saga);
    const missingFromSaga = computeMissingFromSaga(seed, saga);
    console.log(`  → ${mismatches.length} accounts with different name or type`);
    console.log(`  → ${missingFromSeed.length} accounts in Saga but NOT in seed`);
    console.log(`  → ${missingFromSaga.length} accounts in seed but NOT in Saga (we extended OMFP)`);

    const bundle = {
      generatedAt: new Date().toISOString(),
      stats: {
        seedCount: seed.length,
        sagaCount: saga.length,
        answerCount: answers.length,
        distinctContBaseInJournals: usage.length,
        unmappedInProduction: unmappedInProd.length,
        nameOrTypeMismatches: mismatches.length,
        missingFromSeed: missingFromSeed.length,
        seedOnly: missingFromSaga.length,
      },
      seed,
      saga,
      answers,
      journalUsage: usage,
      deltas: {
        nameOrTypeMismatches: mismatches,
        missingFromSeed,
        seedOnly: missingFromSaga,
      },
    };

    mkdirSync(join(ROOT, "temp"), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(bundle, null, 2));
    console.log(`\nWrote ${OUTPUT_PATH}`);
    console.log(`Size: ${(JSON.stringify(bundle).length / 1024).toFixed(1)} KB`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
