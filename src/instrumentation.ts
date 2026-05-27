/**
 * Next.js instrumentation hook. Runs once per server process at boot,
 * in both dev (`next dev`) and production (`next start`).
 *
 * We use it to start the journal-import queue worker (polling loop over
 * Postgres + MinIO). Edge runtime is skipped — the worker uses prisma
 * and the AWS SDK, both Node-only.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startImportWorker } = await import("@/modules/ingestion/worker");
  await startImportWorker();
}
