/**
 * End-to-end verification of period-scoped VERTICAL allocations (axis B,
 * ADR-0004) against the real qhm21 journal.
 *
 * Injects a dated cont->vertical reallocation effective from a mid-year month
 * and asserts, on the owner snapshot's single-month verticalBreakdown:
 *   - at the switch month the cont's expense leaves the old vertical and lands
 *     on the new one (conserved),
 *   - the month before the switch is untouched,
 *   - removing the version restores the baseline.
 *
 *   npx tsx scripts/verify-period-verticals.ts
 */

import { prisma } from "@/lib/db";
import { periodKey } from "@/lib/period";
import { getAvailablePeriods } from "@/modules/balances";
import { loadOwnerSnapshot } from "@/modules/reporting/owner";

const SLUG = "qhm21-network-srl";
const CONT = "6123";

function vExpenses(
  breakdown: { name: string; expenses: number }[],
  name: string
): number {
  return breakdown.find((b) => b.name === name)?.expenses ?? 0;
}

async function snapVerticals(
  base: { clientId: string; clientName: string; clientCui: string | null; clientSlug: string },
  year: number,
  month: number
): Promise<{ name: string; expenses: number }[]> {
  const snap = await loadOwnerSnapshot({ ...base, year, month });
  return snap.verticalBreakdown.map((b) => ({ name: b.name, expenses: b.expenses }));
}

async function main() {
  const client = await prisma.client.findFirst({ where: { slug: SLUG } });
  if (!client) throw new Error(`Client ${SLUG} not found`);
  const clientId = client.id;
  const base = {
    clientId,
    clientName: client.name,
    clientCui: client.cui ?? null,
    clientSlug: client.slug,
  };

  const periods = await getAvailablePeriods(clientId);
  const year = periods[periods.length - 1].year;
  const month = periods[periods.length - 1].month;
  const monthsThisYear = periods.filter((p) => p.year === year).map((p) => p.month);
  const switchMonth = monthsThisYear.length >= 3 ? month - 1 : Math.max(2, month);
  const priorMonth = switchMonth - 1;
  const hasPrior = periods.some((p) => p.year === year && p.month === priorMonth);

  const current = await prisma.verticalAllocation.findFirst({
    where: { clientId, cont: CONT, effectiveFrom: 0 },
  });
  if (!current) throw new Error(`cont ${CONT} has no inception allocation`);

  const verticals = await prisma.vertical.findMany({ where: { clientId, isDefault: false } });
  const currentSplits = current.splits as { verticalId: string; percent: number }[];
  const currentVId = currentSplits[0]?.verticalId;
  const oldV = verticals.find((v) => v.id === currentVId);
  const newV = verticals.find((v) => v.id !== currentVId);
  if (!oldV || !newV) throw new Error("need two non-default verticals");

  console.log(`Client ${SLUG}; cont ${CONT}`);
  console.log(`Reallocating ${CONT}: "${oldV.name}" -> "${newV.name}" from ${year}-${switchMonth}`);

  // True baseline (no injected version).
  const baseSwitch = await snapVerticals(base, year, switchMonth);
  const basePrior = hasPrior ? await snapVerticals(base, year, priorMonth) : null;

  const injected = await prisma.verticalAllocation.create({
    data: {
      clientId,
      cont: CONT,
      scope: "contBase",
      splits: [{ verticalId: newV.id, percent: 100 }],
      effectiveFrom: periodKey(year, switchMonth),
      effectiveTo: null,
    },
  });

  let failures = 0;
  try {
    const afterSwitch = await snapVerticals(base, year, switchMonth);
    const afterPrior = hasPrior ? await snapVerticals(base, year, priorMonth) : null;

    const out = vExpenses(baseSwitch, oldV.name) - vExpenses(afterSwitch, oldV.name);
    const inn = vExpenses(afterSwitch, newV.name) - vExpenses(baseSwitch, newV.name);
    if (Math.abs(out - inn) > 0.01 || Math.abs(out) < 0.01) {
      console.error(`  FAIL switch ${year}-${switchMonth}: out=${out.toFixed(2)} in=${inn.toFixed(2)}`);
      failures++;
    }
    if (hasPrior && afterPrior && basePrior) {
      const dOld = vExpenses(afterPrior, oldV.name) - vExpenses(basePrior, oldV.name);
      const dNew = vExpenses(afterPrior, newV.name) - vExpenses(basePrior, newV.name);
      if (Math.abs(dOld) > 0.01 || Math.abs(dNew) > 0.01) {
        console.error(`  FAIL prior ${year}-${priorMonth}: changed dOld=${dOld.toFixed(2)} dNew=${dNew.toFixed(2)}`);
        failures++;
      }
    }
    console.log(
      `Switch-month shift onto "${newV.name}": ${(vExpenses(afterSwitch, newV.name) - vExpenses(baseSwitch, newV.name)).toFixed(2)} lei` +
        (hasPrior ? ` · prior month untouched` : " · (no prior month)")
    );
    console.log(failures === 0 ? "AXIS-B SNAPSHOT CHECKS: PASS" : `AXIS-B SNAPSHOT CHECKS: ${failures} FAIL`);

    await prisma.verticalAllocation.delete({ where: { id: injected.id } });
    const restored = await snapVerticals(base, year, switchMonth);
    const restoredOk = JSON.stringify(restored) === JSON.stringify(baseSwitch);
    console.log(restoredOk ? "RESTORE: PASS" : "RESTORE: FAIL");
    if (!restoredOk) failures++;
  } finally {
    await prisma.verticalAllocation.deleteMany({ where: { id: injected.id } });
    await prisma.$disconnect();
  }
  if (failures > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
