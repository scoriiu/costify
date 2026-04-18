/**
 * One-shot backfill: populates the new boolean flags on AccountCatalog rows
 * that were created before the ADR-0001 refactor.
 *
 * Idempotent: running it twice does nothing on the second run.
 *
 * Usage:
 *   npx tsx scripts/backfill-catalog-flags.ts          # local DB
 *   npx tsx scripts/backfill-catalog-flags.ts --apply  # local DB, write
 *
 * To run in production, port-forward the cluster postgres then set DATABASE_URL
 * to the forwarded connection and run with --apply.
 */

import { prisma } from "@/lib/db";
import { deriveFlags } from "@/modules/accounts/flags";
import type { AccountSpecial } from "@/modules/accounts";

const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await prisma.accountCatalog.findMany();
  console.log(`Inspecting ${rows.length} AccountCatalog rows...`);

  let toUpdate = 0;
  const updates: Array<{
    code: string;
    isClosing: boolean;
    isProfitTax: boolean;
    isProfitDistribution: boolean;
    isExtraBilantier: boolean;
    cashRole: string | null;
    arRole: string | null;
    apRole: string | null;
    vatRole: string | null;
    payrollRole: string | null;
  }> = [];

  for (const row of rows) {
    const derived = deriveFlags(row.code, row.special as AccountSpecial | null);

    const changed =
      row.isClosing !== derived.isClosing ||
      row.isProfitTax !== derived.isProfitTax ||
      row.isProfitDistribution !== derived.isProfitDistribution ||
      row.isExtraBilantier !== derived.isExtraBilantier ||
      row.cashRole !== derived.cashRole ||
      row.arRole !== derived.arRole ||
      row.apRole !== derived.apRole ||
      row.vatRole !== derived.vatRole ||
      row.payrollRole !== derived.payrollRole;

    if (!changed) continue;

    toUpdate++;
    updates.push({
      code: row.code,
      isClosing: derived.isClosing,
      isProfitTax: derived.isProfitTax,
      isProfitDistribution: derived.isProfitDistribution,
      isExtraBilantier: derived.isExtraBilantier,
      cashRole: derived.cashRole,
      arRole: derived.arRole,
      apRole: derived.apRole,
      vatRole: derived.vatRole,
      payrollRole: derived.payrollRole,
    });
  }

  console.log(`${toUpdate} rows need flag backfill.`);
  if (toUpdate === 0) {
    console.log("Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  console.log("\nSample changes (first 10):");
  for (const u of updates.slice(0, 10)) {
    const flags = [];
    if (u.isClosing) flags.push("closing");
    if (u.isProfitTax) flags.push("profit_tax");
    if (u.isProfitDistribution) flags.push("profit_distribution");
    if (u.isExtraBilantier) flags.push("extra_bilantier");
    if (u.cashRole) flags.push(`cash=${u.cashRole}`);
    if (u.arRole) flags.push(`ar=${u.arRole}`);
    if (u.apRole) flags.push(`ap=${u.apRole}`);
    if (u.vatRole) flags.push(`vat=${u.vatRole}`);
    if (u.payrollRole) flags.push(`payroll=${u.payrollRole}`);
    console.log(`  ${u.code.padEnd(8)} → ${flags.join(", ") || "(none)"}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Pass --apply to write changes.");
    await prisma.$disconnect();
    return;
  }

  console.log("\nApplying...");
  for (const u of updates) {
    await prisma.accountCatalog.update({
      where: { code: u.code },
      data: {
        isClosing: u.isClosing,
        isProfitTax: u.isProfitTax,
        isProfitDistribution: u.isProfitDistribution,
        isExtraBilantier: u.isExtraBilantier,
        cashRole: u.cashRole,
        arRole: u.arRole,
        apRole: u.apRole,
        vatRole: u.vatRole,
        payrollRole: u.payrollRole,
      },
    });
  }

  console.log(`Updated ${updates.length} rows.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
