/**
 * Re-runs the OMFP category seed on existing clients to backfill new
 * sub-categories added to the seed definitions over time.
 *
 * Idempotent: only creates categories and mappings that don't exist yet.
 * Never renames, never deletes, never reassigns a contabil's manual work.
 *
 * Usage:
 *   tsx scripts/reseed-categories.ts                  # all active clients
 *   tsx scripts/reseed-categories.ts --client=<slug>  # one specific client
 *   tsx scripts/reseed-categories.ts --dry-run        # report only, no writes
 *
 * After running, you'll likely want to republish the latest month per client
 * so the new sub-categories appear in the owner-facing snapshot:
 *   tsx scripts/publish-latest-month.ts --force
 */

import { prisma } from "../src/lib/db";
import { seedOmfpDefaults } from "../src/modules/categories/seed";

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
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });

  if (clients.length === 0) {
    console.log("Niciun client de procesat.");
    return;
  }

  let totalCategories = 0;
  let totalMappings = 0;

  for (const client of clients) {
    if (args.dryRun) {
      console.log(`- ${client.slug}: would reseed (dry-run)`);
      continue;
    }
    const report = await seedOmfpDefaults(prisma, client.id);
    const note =
      report.categoriesCreated + report.mappingsCreated === 0
        ? "(no changes — already up to date)"
        : `+${report.categoriesCreated} categorii, +${report.mappingsCreated} mappings`;
    console.log(`- ${client.slug}: ${note}`);
    totalCategories += report.categoriesCreated;
    totalMappings += report.mappingsCreated;
  }

  console.log(
    `\nDone. ${clients.length} clienti procesati. +${totalCategories} categorii, +${totalMappings} mappings.${args.dryRun ? " [DRY RUN]" : ""}`
  );
  console.log(
    `\nIf any clients got new sub-categories, republish their latest month:\n  tsx scripts/publish-latest-month.ts --force`
  );
}

main()
  .catch((err) => {
    console.error("Reseed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
