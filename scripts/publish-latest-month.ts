/**
 * Publishes a single PublishedPeriod row per client: the most recent (year, month)
 * that has journal data.
 *
 * This is the realistic onboarding action — a new accountant on Costify draws
 * a line: "everything up to here is official, I publish lunar from now on."
 *
 * Idempotent: if the latest month is already published, the client is skipped.
 *
 * Usage:
 *   tsx scripts/publish-latest-month.ts                   # all active clients
 *   tsx scripts/publish-latest-month.ts --client=<slug>
 *   tsx scripts/publish-latest-month.ts --dry-run
 */

import { prisma } from "../src/lib/db";
import { publishPeriod } from "../src/modules/publishing";

interface Args {
  clientSlug: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { clientSlug: null, dryRun: false };
  for (const a of argv) {
    if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--client=")) args.clientSlug = a.slice("--client=".length);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const where = args.clientSlug
    ? { slug: args.clientSlug, active: true }
    : { active: true };

  const clients = await prisma.client.findMany({
    where,
    select: { id: true, slug: true, name: true, userId: true },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) {
    console.log("Niciun client de procesat.");
    return;
  }

  let published = 0;
  let skipped = 0;
  let noData = 0;

  for (const client of clients) {
    const latest = await prisma.journalLine.findFirst({
      where: { clientId: client.id, deletedAt: null },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { year: true, month: true },
    });

    if (!latest) {
      console.log(`- ${client.slug}: no journal data, skipping`);
      noData += 1;
      continue;
    }

    const existing = await prisma.publishedPeriod.findUnique({
      where: {
        clientId_year_month: {
          clientId: client.id,
          year: latest.year,
          month: latest.month,
        },
      },
      select: { id: true, publishedAt: true },
    });

    if (existing) {
      console.log(
        `- ${client.slug}: ${latest.year}-${String(latest.month).padStart(2, "0")} already published (skip)`
      );
      skipped += 1;
      continue;
    }

    if (args.dryRun) {
      console.log(
        `- ${client.slug}: would publish ${latest.year}-${String(latest.month).padStart(2, "0")}`
      );
      continue;
    }

    try {
      await publishPeriod({
        clientId: client.id,
        year: latest.year,
        month: latest.month,
        publishedBy: client.userId,
        noteForOwner: null,
      });
      console.log(
        `- ${client.slug}: published ${latest.year}-${String(latest.month).padStart(2, "0")}`
      );
      published += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`- ${client.slug}: FAILED — ${msg}`);
    }
  }

  console.log(
    `\nDone. Published: ${published}. Skipped: ${skipped}. No data: ${noData}.${args.dryRun ? " [DRY RUN]" : ""}`
  );
}

main()
  .catch((err) => {
    console.error("Publish-latest failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
