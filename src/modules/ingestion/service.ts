import { prisma } from "@/lib/db";
import { createHash, randomUUID } from "crypto";
import { parseJournalXLSXStreaming } from "./journal-parser";
import { buildPartnerMappings } from "./partner-extractor";
import { bulkUpsertFromImport } from "@/modules/accounts";
import { recordAuditEvent } from "@/modules/audit";
import { markPeriodsAsStale } from "@/modules/publishing";
import { bumpClientDataVersion } from "@/modules/clients/data-version";
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
  const tStart = performance.now();
  const fileHash = createHash("sha256").update(input.buffer).digest("hex");
  const tHash = performance.now();
  // Streaming parser via yauzl + sax. The buffer is still in memory (route
  // handler buffers the multipart upload), but the XLSX zip is decompressed
  // and the sheet XML is parsed row-by-row, so peak heap stays bounded
  // (~45 MB) instead of exploding to 1.4+ GB on a 19 MB Saga export.
  const parseResult = await parseJournalXLSXStreaming(input.buffer);
  const tParse = performance.now();

  if (parseResult.entries.length === 0) {
    const detail = parseResult.errors.length > 0
      ? parseResult.errors.map((e) => e.message).join("; ")
      : `Fisierul a fost citit (${parseResult.totalRaw} randuri) dar nicio intrare valida nu a fost extrasa. Verificati formatul coloanelor.`;
    return err(appError("PARSE_ERROR", detail, {
      errors: parseResult.errors,
      totalRaw: parseResult.totalRaw,
    }));
  }

  const newEntries = await filterDuplicates(input.clientId, parseResult.entries);
  const tDedup = performance.now();

  if (newEntries.length === 0) {
    console.log(
      `[importJournal] client=${input.clientId.slice(0, 8)} ALL_DUPLICATES ` +
      `fileBytes=${input.buffer.length} parsed=${parseResult.entries.length} ` +
      `hash=${(tHash - tStart).toFixed(0)}ms parse=${(tParse - tHash).toFixed(0)}ms ` +
      `dedup=${(tDedup - tParse).toFixed(0)}ms total=${(tDedup - tStart).toFixed(0)}ms`
    );
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
  const tEvent = performance.now();

  await storeJournalLines(input.clientId, importEvent.id, newEntries);
  const tStore = performance.now();
  await updatePartnerMappings(input.clientId, parseResult.entries);
  const tPartners = performance.now();
  await bulkUpsertFromImport(input.clientId, parseResult.accountNames);
  const tAccounts = performance.now();

  const touchedPeriods = uniquePeriods(newEntries);
  if (touchedPeriods.length > 0) {
    await markPeriodsAsStale(input.clientId, touchedPeriods);
  }
  const tStale = performance.now();

  // Invalidate every cached derivative (balance, CPP, mapari, owner snapshot, KPIs).
  await bumpClientDataVersion(input.clientId);
  const tBump = performance.now();

  const partnerCount = uniquePartnerCount(parseResult.entries);
  console.log(
    `[importJournal] client=${input.clientId.slice(0, 8)} ` +
    `fileBytes=${input.buffer.length} parsed=${parseResult.entries.length} ` +
    `new=${newEntries.length} partners=${partnerCount} ` +
    `accounts=${parseResult.accountNames.size} periods=${touchedPeriods.length} | ` +
    `hash=${(tHash - tStart).toFixed(0)}ms ` +
    `parse=${(tParse - tHash).toFixed(0)}ms ` +
    `dedup=${(tDedup - tParse).toFixed(0)}ms ` +
    `event=${(tEvent - tDedup).toFixed(0)}ms ` +
    `store=${(tStore - tEvent).toFixed(0)}ms ` +
    `partners=${(tPartners - tStore).toFixed(0)}ms ` +
    `accounts=${(tAccounts - tPartners).toFixed(0)}ms ` +
    `stale=${(tStale - tAccounts).toFixed(0)}ms ` +
    `bump=${(tBump - tStale).toFixed(0)}ms ` +
    `total=${(tBump - tStart).toFixed(0)}ms`
  );

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

/**
 * Bulk insert journal lines via raw SQL + UNNEST.
 *
 * Pre-refactor this used `prisma.journalLine.createMany` in batches of 5000.
 * On UpperHouse's 193,684-row export that took ~9.5 s, dominated entirely
 * by Prisma's per-row argument validation + Decimal class construction in
 * Node — the database itself can absorb 200k rows in ~2 s.
 *
 * The raw SQL path does ZERO ORM hydration: we pass 18 parallel typed
 * arrays through Postgres's UNNEST(), letting the database itself do the
 * conversion. The whole batch is a single round-trip, fully parameterized
 * (no SQL injection risk), and Decimal columns just receive numeric values.
 */
async function storeJournalLines(
  clientId: string,
  importEventId: string,
  entries: JournalEntry[]
) {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const n = batch.length;

    const ids = new Array<string>(n);
    const clientIds = new Array<string>(n);
    const importEventIds = new Array<string>(n);
    const datas = new Array<Date>(n);
    const years = new Array<number>(n);
    const months = new Array<number>(n);
    const ndps = new Array<string>(n);
    const contDs = new Array<string>(n);
    const contDBases = new Array<string>(n);
    const contCs = new Array<string>(n);
    const contCBases = new Array<string>(n);
    const sumas = new Array<string>(n);
    const explicaties = new Array<string>(n);
    const felDs = new Array<string>(n);
    const categories = new Array<string | null>(n);
    const cods = new Array<string | null>(n);
    const validats = new Array<string | null>(n);
    const tvas = new Array<string | null>(n);
    const dedupHashes = new Array<string>(n);

    for (let j = 0; j < n; j++) {
      const e = batch[j];
      ids[j] = randomUUID();
      clientIds[j] = clientId;
      importEventIds[j] = importEventId;
      datas[j] = e.data;
      years[j] = e.year;
      months[j] = e.month;
      ndps[j] = e.ndp;
      contDs[j] = e.contD;
      contDBases[j] = e.contDBase;
      contCs[j] = e.contC;
      contCBases[j] = e.contCBase;
      sumas[j] = e.suma.toFixed(2);
      explicaties[j] = e.explicatie;
      felDs[j] = e.felD;
      categories[j] = e.categorie;
      cods[j] = e.cod;
      validats[j] = e.validat;
      tvas[j] = e.tva === null ? null : e.tva.toFixed(2);
      dedupHashes[j] = computeDedupHash(e);
    }

    await prisma.$executeRaw`
      INSERT INTO "JournalLine" (
        id, "clientId", "importEventId", data, year, month, ndp,
        "contD", "contDBase", "contC", "contCBase",
        suma, explicatie, "felD", categorie, cod, validat, tva, "dedupHash"
      )
      SELECT
        id, "clientId", "importEventId", data, year, month, ndp,
        "contD", "contDBase", "contC", "contCBase",
        suma::numeric, explicatie, "felD", categorie, cod, validat,
        tva::numeric, "dedupHash"
      FROM UNNEST(
        ${ids}::text[],
        ${clientIds}::text[],
        ${importEventIds}::text[],
        ${datas}::timestamp[],
        ${years}::int[],
        ${months}::int[],
        ${ndps}::text[],
        ${contDs}::text[],
        ${contDBases}::text[],
        ${contCs}::text[],
        ${contCBases}::text[],
        ${sumas}::text[],
        ${explicaties}::text[],
        ${felDs}::text[],
        ${categories}::text[],
        ${cods}::text[],
        ${validats}::text[],
        ${tvas}::text[],
        ${dedupHashes}::text[]
      ) AS t(
        id, "clientId", "importEventId", data, year, month, ndp,
        "contD", "contDBase", "contC", "contCBase",
        suma, explicatie, "felD", categorie, cod, validat, tva, "dedupHash"
      )
    `;
  }
}

function uniquePartnerCount(entries: JournalEntry[]): number {
  return buildPartnerMappings(entries).length;
}

function uniquePeriods(entries: JournalEntry[]): Array<{ year: number; month: number }> {
  const seen = new Map<string, { year: number; month: number }>();
  for (const e of entries) {
    const k = `${e.year}-${e.month}`;
    if (!seen.has(k)) seen.set(k, { year: e.year, month: e.month });
  }
  return Array.from(seen.values());
}

function uniquePeriodsFromDates(dates: Date[]): Array<{ year: number; month: number }> {
  const seen = new Map<string, { year: number; month: number }>();
  for (const d of dates) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const k = `${y}-${m}`;
    if (!seen.has(k)) seen.set(k, { year: y, month: m });
  }
  return Array.from(seen.values());
}

/**
 * Bulk-upsert partner mappings via a single SQL `INSERT ... ON CONFLICT
 * DO UPDATE`.
 *
 * Pre-refactor this fired `prisma.journalPartner.upsert()` once per partner
 * in a sequential `for` loop. On UpperHouse's journal that meant 10,812
 * round-trips at ~0.5 ms each = ~5.3 s of wall time, all of which was
 * client-side serialization + network latency, not DB work.
 *
 * The current implementation pushes the whole batch into Postgres as a
 * single parameterized statement using positional placeholders. The
 * `UNNEST(...)` array trick is the canonical Postgres pattern for bulk
 * upserts: it builds a virtual table from parallel arrays of column values
 * and feeds it straight into `INSERT ... SELECT`. One round-trip, all
 * conflict resolution happens server-side.
 *
 * IDs are generated in JS via crypto.randomUUID() because Prisma's
 * @default(cuid()) only fires through the ORM layer, not $executeRaw. The
 * schema field is just `String` with no format constraint, so coexisting
 * cuid and uuid id strings is safe — they're both unique opaque strings
 * to every other consumer.
 */
async function updatePartnerMappings(clientId: string, entries: JournalEntry[]) {
  const partners = buildPartnerMappings(entries);
  if (partners.length === 0) return;

  const ids = partners.map(() => randomUUID());
  const clientIds = partners.map(() => clientId);
  const analyticAccounts = partners.map((p) => p.analyticAccount);
  const contBases = partners.map((p) => p.contBase);
  const partnerNames = partners.map((p) => p.partnerName);
  const cods = partners.map((p) => p.cod);

  await prisma.$executeRaw`
    INSERT INTO "JournalPartner" (id, "clientId", "analyticAccount", "contBase", "partnerName", cod)
    SELECT * FROM UNNEST(
      ${ids}::text[],
      ${clientIds}::text[],
      ${analyticAccounts}::text[],
      ${contBases}::text[],
      ${partnerNames}::text[],
      ${cods}::text[]
    )
    ON CONFLICT ("clientId", "analyticAccount") DO UPDATE SET
      "partnerName" = EXCLUDED."partnerName",
      "contBase"    = EXCLUDED."contBase",
      cod           = EXCLUDED.cod
  `;
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

  const touched = uniquePeriodsFromDates(entries.map((e) => e.data));
  if (touched.length > 0) {
    await markPeriodsAsStale(clientId, touched);
  }

  // Historical correction changes computed downstream — bump so caches recompute.
  await bumpClientDataVersion(clientId);

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
