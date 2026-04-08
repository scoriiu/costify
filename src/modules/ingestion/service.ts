import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { parseJournalXLSX } from "./journal-parser";
import { buildPartnerMappings } from "./partner-extractor";
import { recordAuditEvent } from "@/modules/audit";
import type { Result } from "@/shared/errors";
import { ok, err, appError } from "@/shared/errors";
import type { JournalEntry } from "./types";

const BATCH_SIZE = 5000;

export interface ImportResult {
  importEventId: string;
  entriesAdded: number;
  entriesSkipped: number;
  dateStart: Date | null;
  dateEnd: Date | null;
  totalParsed: number;
  errorsCount: number;
}

export interface ImportInput {
  clientId: string;
  userId: string;
  fileName: string;
  buffer: Buffer;
}

export async function importJournal(input: ImportInput): Promise<Result<ImportResult>> {
  const fileHash = createHash("sha256").update(input.buffer).digest("hex");
  const parseResult = parseJournalXLSX(input.buffer);

  if (parseResult.entries.length === 0) {
    return err(appError("PARSE_ERROR", "Nu s-au gasit intrari in fisier", {
      errors: parseResult.errors,
    }));
  }

  const newEntries = await filterDuplicates(input.clientId, parseResult.entries);

  if (newEntries.length === 0) {
    return ok({
      importEventId: "",
      entriesAdded: 0,
      entriesSkipped: parseResult.entries.length,
      dateStart: null,
      dateEnd: null,
      totalParsed: parseResult.entries.length,
      errorsCount: parseResult.errors.length,
    });
  }

  const dates = newEntries.map((e) => e.data).sort((a, b) => a.getTime() - b.getTime());
  const dateStart = dates[0];
  const dateEnd = dates[dates.length - 1];

  const importEvent = await prisma.importEvent.create({
    data: {
      clientId: input.clientId,
      fileName: input.fileName,
      fileHash,
      sourceFormat: "saga",
      entriesAdded: newEntries.length,
      dateStart,
      dateEnd,
      status: "ready",
    },
  });

  await storeJournalLines(input.clientId, importEvent.id, newEntries);
  await updatePartnerMappings(input.clientId, parseResult.entries);

  await recordAuditEvent({
    tenantId: input.clientId,
    actorId: input.userId,
    actorType: "user",
    pipelineStage: "ingest",
    action: "create",
    entityType: "import_event",
    entityId: importEvent.id,
    before: null,
    after: {
      fileName: input.fileName,
      fileHash,
      entriesAdded: newEntries.length,
      dateStart: dateStart.toISOString(),
      dateEnd: dateEnd.toISOString(),
    },
    metadata: {
      totalParsed: parseResult.entries.length,
      duplicatesSkipped: parseResult.entries.length - newEntries.length,
    },
  });

  return ok({
    importEventId: importEvent.id,
    entriesAdded: newEntries.length,
    entriesSkipped: parseResult.entries.length - newEntries.length,
    dateStart,
    dateEnd,
    totalParsed: parseResult.entries.length,
    errorsCount: parseResult.errors.length,
  });
}

function computeDedupHash(entry: JournalEntry): string {
  return createHash("md5")
    .update(`${entry.data.toISOString()}|${entry.contD}|${entry.contC}|${entry.suma}|${entry.explicatie}`)
    .digest("hex");
}

async function filterDuplicates(
  clientId: string,
  entries: JournalEntry[]
): Promise<JournalEntry[]> {
  const existingHashes = await prisma.journalLine.findMany({
    where: { clientId, deletedAt: null },
    select: { dedupHash: true },
  });

  const hashSet = new Set(existingHashes.map((r) => r.dedupHash));
  return entries.filter((e) => !hashSet.has(computeDedupHash(e)));
}

async function storeJournalLines(
  clientId: string,
  importEventId: string,
  entries: JournalEntry[]
) {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await prisma.journalLine.createMany({
      data: batch.map((e) => ({
        clientId,
        importEventId,
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
        dedupHash: computeDedupHash(e),
      })),
    });
  }
}

async function updatePartnerMappings(clientId: string, entries: JournalEntry[]) {
  const partners = buildPartnerMappings(entries);
  if (partners.length === 0) return;

  for (const p of partners) {
    await prisma.journalPartner.upsert({
      where: { clientId_analyticAccount: { clientId, analyticAccount: p.analyticAccount } },
      update: { partnerName: p.partnerName, contBase: p.contBase, cod: p.cod },
      create: {
        clientId,
        analyticAccount: p.analyticAccount,
        contBase: p.contBase,
        partnerName: p.partnerName,
        cod: p.cod,
      },
    });
  }
}

export async function softDeleteEntriesFrom(
  clientId: string,
  userId: string,
  fromDate: Date
): Promise<Result<{ deletedCount: number }>> {
  const entries = await prisma.journalLine.findMany({
    where: { clientId, deletedAt: null, data: { gte: fromDate } },
    select: { id: true, data: true, contD: true, contC: true, suma: true },
  });

  if (entries.length === 0) {
    return err(appError("NOT_FOUND", "Nu exista intrari de la aceasta data"));
  }

  await prisma.journalLine.updateMany({
    where: { clientId, deletedAt: null, data: { gte: fromDate } },
    data: { deletedAt: new Date() },
  });

  await recordAuditEvent({
    tenantId: clientId,
    actorId: userId,
    actorType: "user",
    pipelineStage: "journal",
    action: "delete",
    entityType: "journal_lines",
    entityId: clientId,
    before: { count: entries.length, entries: entries.slice(0, 50) },
    after: null,
    metadata: { fromDate: fromDate.toISOString(), totalDeleted: entries.length },
  });

  return ok({ deletedCount: entries.length });
}
