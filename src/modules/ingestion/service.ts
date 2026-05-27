import { prisma } from "@/lib/db";
import { createHash, randomUUID } from "crypto";
import { Client as PgClient } from "pg";
import { from as pgCopyFrom } from "pg-copy-streams";
import { parseJournalXLSXStreaming } from "./journal-parser";
import { buildPartnerMappings } from "./partner-extractor";
import { bulkUpsertFromImport } from "@/modules/accounts";
import { recordAuditEvent } from "@/modules/audit";
import { markPeriodsAsStale } from "@/modules/publishing";
import { bumpClientDataVersion } from "@/modules/clients/data-version";
import { getBalanceRows } from "@/modules/balances";
import { precomputePeriods } from "@/modules/balances/computed-period";
import { computeKpis, computeCpp, computeCppF20 } from "@/modules/reporting";
import { getCatalogMap } from "@/modules/accounts";
import { getRegimeForPeriod } from "@/modules/clients/tax-regime";
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
  /**
   * Optional pre-created ImportEvent id. When set (worker mode), we reuse
   * the row instead of creating a new one — the row lifecycle is owned by
   * the queue: API creates it `queued`, worker flips it through `parsing`,
   * `storing`, `finalizing`, `ready` (or `failed`). When unset (legacy
   * synchronous mode, retained for tests), we create the row ourselves at
   * the end with `status: "ready"`.
   */
  importEventId?: string;
  /**
   * Called by stages of the pipeline with progress updates. The worker
   * writes these straight to the ImportEvent row so the UI poll sees
   * real numbers. Synchronous callers can ignore it (no-op default).
   */
  onProgress?: ProgressReporter;
}

export type ProgressStage = "parsing" | "storing" | "finalizing";

export interface ProgressUpdate {
  stage: ProgressStage;
  percent: number;
  label: string;
  totalEntries?: number;
  processedEntries?: number;
}

export type ProgressReporter = (update: ProgressUpdate) => Promise<void> | void;

const noopProgress: ProgressReporter = () => undefined;

export async function importJournal(input: ImportInput): Promise<Result<ImportResult>> {
  const report = input.onProgress ?? noopProgress;
  const tStart = performance.now();
  const fileHash = createHash("sha256").update(input.buffer).digest("hex");

  await report({ stage: "parsing", percent: 5, label: "Se citeste registrul jurnal" });
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

  await report({
    stage: "parsing",
    percent: 45,
    label: `Verific ${parseResult.entries.length.toLocaleString("ro-RO")} de intrari`,
    totalEntries: parseResult.entries.length,
  });

  const newEntries = await filterDuplicates(input.clientId, parseResult.entries);
  const tDedup = performance.now();

  if (newEntries.length === 0) {
    console.log(
      `[importJournal] client=${input.clientId.slice(0, 8)} ALL_DUPLICATES ` +
      `fileBytes=${input.buffer.length} parsed=${parseResult.entries.length} ` +
      `hash=${(tHash - tStart).toFixed(0)}ms parse=${(tParse - tHash).toFixed(0)}ms ` +
      `dedup=${(tDedup - tParse).toFixed(0)}ms total=${(tDedup - tStart).toFixed(0)}ms`
    );
    if (input.importEventId) {
      await prisma.importEvent.update({
        where: { id: input.importEventId },
        data: { status: "ready", entriesAdded: 0, progress: 100 },
      });
    }
    return ok({
      importEventId: input.importEventId ?? "",
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

  // Either reuse the queued row (worker mode) or create a new one (sync mode).
  const importEvent = input.importEventId
    ? await prisma.importEvent.update({
        where: { id: input.importEventId },
        data: {
          fileHash,
          entriesAdded: newEntries.length,
          dateStart,
          dateEnd,
          status: "storing",
          totalEntries: newEntries.length,
          processedEntries: 0,
        },
      })
    : await prisma.importEvent.create({
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

  await report({
    stage: "storing",
    percent: 55,
    label: `Salvez 0 din ${newEntries.length.toLocaleString("ro-RO")} de intrari`,
    totalEntries: newEntries.length,
    processedEntries: 0,
  });

  await storeJournalLines(input.clientId, importEvent.id, newEntries, async (processed) => {
    // Map processed-count to a percentage in the [55, 90] band.
    const frac = newEntries.length === 0 ? 1 : processed / newEntries.length;
    const percent = 55 + frac * 35;
    await report({
      stage: "storing",
      percent,
      label: `Salvez ${processed.toLocaleString("ro-RO")} din ${newEntries.length.toLocaleString("ro-RO")} de intrari`,
      totalEntries: newEntries.length,
      processedEntries: processed,
    });
  });
  const tStore = performance.now();

  await report({ stage: "finalizing", percent: 92, label: "Actualizez partenerii" });
  await updatePartnerMappings(input.clientId, parseResult.entries);
  const tPartners = performance.now();

  await report({ stage: "finalizing", percent: 95, label: "Actualizez planul de conturi" });
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

  // Pre-compute every touched (year, month) into ComputedPeriod so the
  // accountant's first page-load after import is instant. Best-effort:
  // if a period fails to compute we just skip it — the lazy read-path
  // will fall back to live compute on demand. This stage runs AFTER the
  // version bump so the rows we write are tagged with the new version
  // and are immediately valid for future reads.
  await report({ stage: "finalizing", percent: 97, label: "Precalculez balantele" });
  const precomputedBalances = await precomputePeriods(
    input.clientId,
    touchedPeriods,
    async (year, month) => {
      const [balanceResult, catalog, taxRegime] = await Promise.all([
        getBalanceRows(input.clientId, year, month),
        getCatalogMap(),
        getRegimeForPeriod(input.clientId, year, month),
      ]);
      if (!balanceResult.ok) return null;
      return {
        rows: balanceResult.data,
        kpis: computeKpis(balanceResult.data, catalog),
        cpp: computeCpp(balanceResult.data, catalog, { taxRegime }),
        cppF20: computeCppF20(balanceResult.data, catalog, { taxRegime }),
        taxRegime,
      };
    },
  );

  const tPrecompute = performance.now();

  await report({ stage: "finalizing", percent: 100, label: "Import finalizat" });

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
    `precompute=${(tPrecompute - tBump).toFixed(0)}ms (${precomputedBalances}/${touchedPeriods.length}) ` +
    `total=${(tPrecompute - tStart).toFixed(0)}ms`
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
 * Bulk insert journal lines via Postgres's binary-friendly COPY protocol.
 *
 * Evolution of this function on the UpperHouse 19 MB / 194k-row fixture:
 *
 *   prisma.createMany (batches of 5000)              ~9.5 s on a hot pod
 *   raw SQL INSERT ... SELECT FROM UNNEST(...)       ~4.2 s on a hot pod
 *   raw SQL UNNEST                                    ~54 s on prod
 *   COPY FROM STDIN (this implementation)         target ~10-15 s on prod
 *
 * Why COPY is faster than UNNEST for big writes:
 *   - One protocol message instead of one INSERT per batch
 *   - No SQL parser cost per row
 *   - No bind parameter ceiling (Postgres caps prepared statements at
 *     65535 parameters; with 19 columns that's only 3,449 rows per batch)
 *   - Server-side row construction is a tight loop in C
 *
 * Why we still keep our own client-side batches: we want to emit
 * `onBatch(processed)` updates to the UI roughly every 5,000 rows so the
 * progress bar moves. A single 194k-row COPY would block the bar at the
 * same percent for the whole stage.
 *
 * `bumpClientPgConnection` returns a dedicated `pg.Client` for the
 * duration of this function — Prisma's pool doesn't expose the underlying
 * connection, and COPY needs a raw connection. The client is released
 * (and connection returned) in `finally` even on errors.
 */
async function storeJournalLines(
  clientId: string,
  importEventId: string,
  entries: JournalEntry[],
  onBatch?: (processed: number) => Promise<void> | void
) {
  if (entries.length === 0) return;

  const pg = await getPgClient();
  try {
    // synchronous_commit=off across the session — the import is fully
    // restartable from the XLSX in S3 if the pod crashes before the
    // write lands on disk, so the ms-window we lose is worth not
    // fsyncing per WAL flush. Applied at the session level (not LOCAL
    // to a txn) because the previous BEGIN/SET LOCAL/COPY/COMMIT shape
    // measured ~50% slower than the implicit-txn COPY, likely because
    // wrapping COPY in an explicit txn changed where the WAL flush
    // boundary lands.
    await pg.query("SET synchronous_commit = OFF");

    const stream = pg.query(
      pgCopyFrom(
        `COPY "JournalLine" (
          id, "clientId", "importEventId", data, year, month, ndp,
          "contD", "contDBase", "contC", "contCBase",
          suma, explicatie, "felD", categorie, cod, validat, tva, "dedupHash"
        ) FROM STDIN`
      )
    );

    let streamErr: Error | null = null;
    stream.on("error", (e) => { streamErr = e; });
    const finished = new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", (e) => reject(e));
    });

    // One COPY stream for the entire import. We chunk row-encoding in
    // BATCH_SIZE blocks ONLY to emit progress updates between writes —
    // the underlying Postgres operation is a single uninterrupted COPY.
    let processed = 0;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      if (streamErr) throw streamErr;
      const batchEnd = Math.min(i + BATCH_SIZE, entries.length);
      const chunk = encodeCopyChunk(clientId, importEventId, entries, i, batchEnd);

      // Apply backpressure — if the socket buffer fills we wait for drain.
      if (!stream.write(chunk)) {
        await new Promise<void>((resolve) => stream.once("drain", () => resolve()));
      }

      processed = batchEnd;
      if (onBatch) await onBatch(processed);
    }

    stream.end();
    await finished;
  } finally {
    await pg.end();
  }
}

/**
 * Serialize a slice of entries into Postgres COPY text format. Each row
 * is 19 tab-separated values terminated by newline; \N marks null. We
 * escape backslash, tab, newline, and CR per the COPY text spec.
 */
function encodeCopyChunk(
  clientId: string,
  importEventId: string,
  entries: JournalEntry[],
  start: number,
  end: number,
): Buffer {
  const parts: string[] = [];
  for (let j = start; j < end; j++) {
    const e = entries[j];
    parts.push(
      [
        randomUUID(),
        clientId,
        importEventId,
        e.data.toISOString(),
        String(e.year),
        String(e.month),
        copyEscape(e.ndp),
        copyEscape(e.contD),
        copyEscape(e.contDBase),
        copyEscape(e.contC),
        copyEscape(e.contCBase),
        e.suma.toFixed(2),
        copyEscape(e.explicatie),
        copyEscape(e.felD),
        copyEscapeNullable(e.categorie),
        copyEscapeNullable(e.cod),
        copyEscapeNullable(e.validat),
        e.tva === null ? "\\N" : e.tva.toFixed(2),
        computeDedupHash(e),
      ].join("\t")
    );
  }
  parts.push("");
  return Buffer.from(parts.join("\n"), "utf-8");
}

/** Escape a string for Postgres COPY text format. */
function copyEscape(s: string): string {
  // Order matters: backslash first so we don't double-escape the
  // backslashes we're about to introduce.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function copyEscapeNullable(s: string | null): string {
  return s === null ? "\\N" : copyEscape(s);
}

/**
 * Open a dedicated pg.Client for COPY. Reuses the same DATABASE_URL the
 * Prisma pool uses but with a single non-pooled connection — COPY needs
 * a stateful connection and Prisma's pool doesn't expose one.
 */
async function getPgClient(): Promise<PgClient> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  // Strip Prisma-specific query params that pg doesn't understand.
  const cleanUrl = url.replace(/[?&](connection_limit|pool_timeout|schema)=[^&]*/g, "");
  const client = new PgClient({ connectionString: cleanUrl });
  await client.connect();
  return client;
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
