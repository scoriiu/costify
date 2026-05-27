/**
 * In-process journal-import worker.
 *
 * Runs alongside the Next.js server on every pod. Polls Postgres every
 * second for `ImportEvent` rows in `queued` state, atomically claims one,
 * processes it, then loops.
 *
 * Why Postgres (and not Redis/BullMQ): import throughput is
 * single-digits-per-minute peak, so the cost of a real broker is
 * dwarfed by the cost of operating one (extra pod, extra failure mode,
 * extra attack surface). A polled job table is enough — atomic claim
 * via `UPDATE ... WHERE ... AND lockedAt IS NULL RETURNING *` is
 * race-free, and resumption-after-crash is handled by the same query
 * with a `lockedAt < now() - stale` clause.
 *
 * When traffic outgrows this (>50 imports/minute concurrent across
 * pods), the swap to BullMQ is a refactor of two functions in this
 * file (`claimNextJob` and `markFailed`) — the worker loop, the
 * progress contract, and the API are unchanged.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ensureImportsBucket, getBuffer, deleteObject, importFileKey } from "@/lib/object-storage";
import { importJournal, type ProgressUpdate } from "./service";

const POLL_INTERVAL_MS = 1000;
const STALE_LOCK_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const PROGRESS_THROTTLE_MS = 250;

const podId = `${process.env.HOSTNAME ?? "local"}-${randomUUID().slice(0, 8)}`;

let started = false;
let stopping = false;

interface ClaimedJob {
  id: string;
  clientId: string;
  fileName: string;
  fileKey: string;
  attempts: number;
  client: { userId: string };
}

/**
 * Atomically claim a queued job (or a stale-locked one). Returns the
 * claimed row or null if nothing to do.
 *
 * Two cases get picked up:
 *   1. status='queued' AND lockedAt IS NULL — fresh work.
 *   2. status IN ('queued','parsing','storing','finalizing') AND lockedAt
 *      older than STALE_LOCK_MS — abandoned by a crashed worker.
 *
 * `attempts` is incremented at claim time so we have an upper bound on
 * retries; after MAX_ATTEMPTS we mark it failed without re-running.
 */
async function claimNextJob(): Promise<ClaimedJob | null> {
  const staleCutoff = new Date(Date.now() - STALE_LOCK_MS);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      clientId: string;
      fileName: string;
      fileKey: string | null;
      attempts: number;
    }>
  >`
    WITH next AS (
      SELECT id
      FROM "ImportEvent"
      WHERE "fileKey" IS NOT NULL
        AND (
          (status = 'queued' AND "lockedAt" IS NULL)
          OR (status IN ('queued','parsing','storing','finalizing') AND "lockedAt" < ${staleCutoff})
        )
        AND attempts < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "ImportEvent" ie
    SET status = 'parsing',
        "lockedAt" = NOW(),
        "lockedBy" = ${podId},
        attempts = ie.attempts + 1,
        "progressLabel" = 'Se incepe procesarea',
        "errorMessage" = NULL
    FROM next
    WHERE ie.id = next.id
    RETURNING ie.id, ie."clientId", ie."fileName", ie."fileKey", ie.attempts
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  const client = await prisma.client.findUnique({
    where: { id: r.clientId },
    select: { userId: true },
  });
  if (!client) {
    await markFailed(r.id, "Client necunoscut");
    return null;
  }
  return {
    id: r.id,
    clientId: r.clientId,
    fileName: r.fileName,
    fileKey: r.fileKey ?? importFileKey(r.id),
    attempts: r.attempts,
    client,
  };
}

async function markFailed(id: string, message: string): Promise<void> {
  await prisma.importEvent.update({
    where: { id },
    data: {
      status: "failed",
      errorMessage: message.slice(0, 500),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function processJob(job: ClaimedJob): Promise<void> {
  let lastProgressFlush = 0;
  let lastBuffered: ProgressUpdate | null = null;

  const flush = async () => {
    if (!lastBuffered) return;
    const u = lastBuffered;
    lastBuffered = null;
    lastProgressFlush = Date.now();
    await prisma.importEvent.update({
      where: { id: job.id },
      data: {
        status:
          u.stage === "parsing"
            ? "parsing"
            : u.stage === "storing"
              ? "storing"
              : "finalizing",
        progress: Math.max(0, Math.min(100, Math.round(u.percent))),
        progressLabel: u.label,
        ...(u.totalEntries !== undefined ? { totalEntries: u.totalEntries } : {}),
        ...(u.processedEntries !== undefined ? { processedEntries: u.processedEntries } : {}),
      },
    });
  };

  const onProgress = async (u: ProgressUpdate) => {
    lastBuffered = u;
    const now = Date.now();
    if (now - lastProgressFlush >= PROGRESS_THROTTLE_MS || u.percent >= 100) {
      await flush();
    }
  };

  try {
    const buffer = await getBuffer(job.fileKey);
    const result = await importJournal({
      clientId: job.clientId,
      userId: job.client.userId,
      fileName: job.fileName,
      buffer,
      importEventId: job.id,
      onProgress,
    });
    await flush();

    if (!result.ok) {
      await markFailed(job.id, result.error.message);
      return;
    }

    await prisma.importEvent.update({
      where: { id: job.id },
      data: {
        status: "ready",
        progress: 100,
        progressLabel: "Import finalizat",
        lockedAt: null,
        lockedBy: null,
      },
    });

    // Clean up the upload buffer — the import is durably persisted in
    // JournalLine rows now, the XLSX has no further purpose.
    deleteObject(job.fileKey).catch(() => undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[worker] job=${job.id} failed:`, msg);
    // Only mark terminal-failed on the last attempt — otherwise leave the
    // row locked and let the stale-lock sweep pick it up.
    if (job.attempts >= MAX_ATTEMPTS) {
      await markFailed(job.id, msg);
    } else {
      // Release the lock so the next poll re-claims (incrementing attempts).
      await prisma.importEvent.update({
        where: { id: job.id },
        data: { lockedAt: null, lockedBy: null, errorMessage: msg.slice(0, 500) },
      });
    }
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      const job = await claimNextJob();
      if (job) {
        console.log(`[worker] claimed job=${job.id} attempt=${job.attempts}`);
        await processJob(job);
      } else {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (e) {
      console.error("[worker] loop error:", e);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

/**
 * Boot the worker. Idempotent — second calls are no-ops. Wired in
 * `src/instrumentation.ts` so it runs once per pod on server start.
 */
export async function startImportWorker(): Promise<void> {
  if (started) return;
  started = true;
  try {
    await ensureImportsBucket();
  } catch (e) {
    // Don't crash boot if MinIO isn't reachable yet — the worker will
    // retry the bucket check on every job via the storage client.
    console.warn("[worker] ensureImportsBucket failed at boot:", e);
  }
  console.log(`[worker] starting as ${podId}`);
  loop().catch((e) => console.error("[worker] loop crashed:", e));
}

export function stopImportWorker(): void {
  stopping = true;
}
