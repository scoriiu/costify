import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { parseJournalXLSX } from "./journal-parser";
import { buildPartnerMappings } from "./partner-extractor";
import { computeBalanceFromJournal } from "@/modules/balances/compute-balance";
import { recordAuditEvent } from "@/modules/audit";
import type { Result } from "@/shared/errors";
import { ok, err, appError } from "@/shared/errors";
import type { JournalParseResult } from "./types";

const BATCH_SIZE = 5000;

export interface ImportResult {
  datasetId: string;
  years: number[];
  entriesCount: number;
  totalRaw: number;
  errorsCount: number;
  partnersCount: number;
}

export interface ImportInput {
  clientId: string;
  userId: string;
  name: string;
  fileName: string;
  buffer: Buffer;
}

export async function importJournal(input: ImportInput): Promise<Result<ImportResult>> {
  const fileHash = createHash("sha256").update(input.buffer).digest("hex");
  const parseResult = parseJournalXLSX(input.buffer);

  if (parseResult.entries.length === 0) {
    return err(appError("PARSE_ERROR", "No entries parsed", {
      errors: parseResult.errors,
    }));
  }

  const dataset = await createDataset(input, fileHash, parseResult);
  await storeJournalLines(dataset.id, parseResult);
  await storeBalanceRows(dataset.id, parseResult);
  const partnersCount = await storePartnerMappings(dataset.id, parseResult);

  await recordAuditEvent({
    tenantId: input.clientId,
    actorId: input.userId,
    actorType: "user",
    pipelineStage: "ingest",
    action: "create",
    entityType: "dataset",
    entityId: dataset.id,
    before: null,
    after: {
      fileName: input.fileName,
      fileHash,
      entriesCount: parseResult.entries.length,
      years: parseResult.years,
    },
    metadata: { totalRaw: parseResult.totalRaw, errorsCount: parseResult.errors.length },
  });

  return ok({
    datasetId: dataset.id,
    years: parseResult.years,
    entriesCount: parseResult.entries.length,
    totalRaw: parseResult.totalRaw,
    errorsCount: parseResult.errors.length,
    partnersCount,
  });
}

async function createDataset(
  input: ImportInput,
  fileHash: string,
  parseResult: JournalParseResult
) {
  const { years } = parseResult;
  return prisma.dataset.create({
    data: {
      clientId: input.clientId,
      name: input.name,
      fileName: input.fileName,
      fileHash,
      sourceType: "registru_jurnal",
      status: "ready",
      periodYear: years[years.length - 1],
      periodMonth: 12,
    },
  });
}

async function storeJournalLines(datasetId: string, parseResult: JournalParseResult) {
  const { entries } = parseResult;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.journalLine.createMany({
      data: batch.map((e) => ({
        datasetId,
        data: e.data,
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
    });
  }
}

async function storeBalanceRows(datasetId: string, parseResult: JournalParseResult) {
  const { entries, years, accountNames } = parseResult;
  for (const y of years) {
    const months = uniqueMonths(entries, y);
    for (const m of months) {
      const rows = computeBalanceFromJournal(entries, y, m, accountNames);
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        await prisma.balanceRow.createMany({
          data: batch.map((r) => ({
            datasetId,
            year: y,
            month: m,
            cont: r.cont,
            contBase: r.contBase,
            denumire: r.denumire,
            tip: r.tip,
            isLeaf: r.isLeaf,
            hasChild: r.hasChild,
            debInit: r.debInit,
            credInit: r.credInit,
            soldInD: r.soldInD,
            soldInC: r.soldInC,
            debPrec: r.debPrec,
            credPrec: r.credPrec,
            rulajD: r.rulajD,
            rulajC: r.rulajC,
            rulajTD: r.rulajTD,
            rulajTC: r.rulajTC,
            totalDeb: r.totalDeb,
            totalCred: r.totalCred,
            finD: r.finD,
            finC: r.finC,
          })),
        });
      }
    }
  }
}

async function storePartnerMappings(
  datasetId: string,
  parseResult: JournalParseResult
): Promise<number> {
  const partners = buildPartnerMappings(parseResult.entries);
  if (partners.length === 0) return 0;

  await prisma.journalPartner.createMany({
    data: partners.map((p) => ({
      datasetId,
      analyticAccount: p.analyticAccount,
      contBase: p.contBase,
      partnerName: p.partnerName,
      cod: p.cod,
    })),
  });

  return partners.length;
}

function uniqueMonths(entries: JournalParseResult["entries"], year: number): number[] {
  const set = new Set<number>();
  for (const e of entries) {
    if (e.year === year) set.add(e.month);
  }
  return [...set].sort((a, b) => a - b);
}
