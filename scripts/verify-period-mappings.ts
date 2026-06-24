/**
 * End-to-end verification of period-scoped mappings (ADR-0004 PR-3) against
 * the real qhm21 journal in the local DB.
 *
 * It injects a dated reclassification of cont "62" (Servicii externe) to a
 * different expense line from a mid-year month, reloads the line-trends engine,
 * and asserts:
 *   - months BEFORE the effective month are byte-identical to baseline,
 *   - from the effective month on, cont 62's movement leaves the old line and
 *     lands on the new line,
 *   - deleting the version restores the baseline exactly.
 *
 *   npx tsx scripts/verify-period-mappings.ts
 */

import { prisma } from "@/lib/db";
import { periodKey } from "@/lib/period";
import { getAvailablePeriods } from "@/modules/balances";
import { loadLineTrends, loadOwnerSnapshot } from "@/modules/reporting/owner";

const SLUG = "qhm21-network-srl";
const CONT = "62";

function lineTotal(lines: { label: string; total: number }[], label: string): number {
  return lines.find((l) => l.label === label)?.total ?? 0;
}

function itemValue(items: { label: string; value: number }[], label: string): number {
  return items.find((i) => i.label === label)?.value ?? 0;
}

async function loadSnapshotExpense(
  base: { clientId: string; clientName: string; clientCui: string | null; clientSlug: string },
  year: number,
  month: number
): Promise<{ label: string; value: number }[]> {
  const snap = await loadOwnerSnapshot({ ...base, year, month });
  return snap.expenseBreakdown.map((i) => ({ label: i.label, value: i.value }));
}

async function main() {
  const client = await prisma.client.findFirst({ where: { slug: SLUG } });
  if (!client) throw new Error(`Client ${SLUG} not found`);
  const clientId = client.id;

  const periods = await getAvailablePeriods(clientId);
  if (periods.length === 0) throw new Error("no periods");
  const last = periods[periods.length - 1];
  const year = last.year;
  const month = last.month;
  // Prefer a switch month in the MIDDLE of available data (not the last month)
  // so the test discriminates: months before stay, the switch month moves, AND
  // months after the switch also move. Falls back to month when data is thin.
  const monthsThisYear = periods.filter((p) => p.year === year).map((p) => p.month);
  const effectiveMonth = monthsThisYear.length >= 3 ? month - 1 : Math.max(2, month);
  console.log(`Client ${SLUG} ${clientId}`);
  console.log(`Latest period ${year}-${month}; effective switch from ${year}-${effectiveMonth}`);

  // Current mapping for cont 62 + a different expense category to move it to.
  const current = await prisma.accountCategoryMapping.findFirst({
    where: { clientId, cont: CONT, effectiveFrom: 0 },
    include: { category: true },
  });
  if (!current?.category) throw new Error(`cont ${CONT} not mapped at inception`);
  const oldLabel = current.category.name;

  const target = await prisma.costCategory.findFirst({
    where: { clientId, kind: "expense", id: { not: current.categoryId ?? undefined } },
  });
  if (!target) throw new Error("no alternate expense category");
  console.log(`Moving cont ${CONT}: "${oldLabel}" -> "${target.name}" from ${year}-${effectiveMonth}`);

  const baseline = await loadLineTrends({ clientId, year, month, windowMonths: 12 });

  // Inject an open dated version: cont 62 -> target from effectiveMonth on.
  const injected = await prisma.accountCategoryMapping.create({
    data: {
      clientId,
      cont: CONT,
      scope: "contBase",
      categoryId: target.id,
      effectiveFrom: periodKey(year, effectiveMonth),
      effectiveTo: null,
    },
  });

  try {
    const after = await loadLineTrends({ clientId, year, month, windowMonths: 12 });

    let failures = 0;
    const months = baseline.months;
    months.forEach((mm, i) => {
      const beforeOld = lineTotal(baseline.costExpense, oldLabel);
      const beforeNew = lineTotal(baseline.costExpense, target.name);
      // per-month value via the series arrays
      const bOld = baseline.costExpense.find((l) => l.label === oldLabel)?.values[i] ?? 0;
      const bNew = baseline.costExpense.find((l) => l.label === target.name)?.values[i] ?? 0;
      const aOld = after.costExpense.find((l) => l.label === oldLabel)?.values[i] ?? 0;
      const aNew = after.costExpense.find((l) => l.label === target.name)?.values[i] ?? 0;
      void beforeOld;
      void beforeNew;

      const isAfter = mm.year * 100 + mm.month >= periodKey(year, effectiveMonth);
      if (!isAfter) {
        if (Math.abs(aOld - bOld) > 0.01 || Math.abs(aNew - bNew) > 0.01) {
          console.error(`  FAIL ${mm.year}-${mm.month} (before): changed unexpectedly`);
          failures++;
        }
      } else {
        // cont 62's movement should have left oldLabel and joined target.
        const movedOut = bOld - aOld; // amount removed from old line
        const movedIn = aNew - bNew; // amount added to new line
        if (Math.abs(movedOut - movedIn) > 0.01) {
          console.error(
            `  FAIL ${mm.year}-${mm.month} (after): movedOut=${movedOut} != movedIn=${movedIn}`
          );
          failures++;
        }
      }
    });

    const totalShift =
      lineTotal(after.costExpense, target.name) - lineTotal(baseline.costExpense, target.name);
    console.log(`Total YTD shift onto "${target.name}": ${totalShift.toFixed(2)} lei`);
    console.log(failures === 0 ? "PER-MONTH CHECKS (line-trends): PASS" : `PER-MONTH CHECKS: ${failures} FAIL`);

    // ---- Owner snapshot (single-month "Luna asta in detaliu" breakdown) ----
    // The snapshot resolves cont->category as-of the SELECTED month. So at the
    // switch month the cont's single-month amount must leave oldLabel and join
    // target; at the month BEFORE the switch nothing moves.
    const snapInput = {
      clientId,
      clientName: client.name,
      clientCui: client.cui ?? null,
      clientSlug: client.slug,
    };
    let snapFailures = 0;

    const baseAtSwitch = await loadSnapshotExpense(snapInput, year, effectiveMonth);

    const priorMonth = effectiveMonth - 1;
    const hasPrior =
      priorMonth >= 1 && periods.some((p) => p.year === year && p.month === priorMonth);

    // Inject already done above (line-trends). Re-load snapshot WITH the version.
    const afterAtSwitch = await loadSnapshotExpense(snapInput, year, effectiveMonth);
    // baseline-vs-after at switch month: baseAtSwitch was loaded WHILE injected
    // (we injected before this block), so reload a true baseline by removing,
    // then re-add. Simpler: compute expected from the same injected state is
    // circular — instead compare the injected snapshot's old/new buckets to the
    // pre-injection baseline we captured implicitly via line-trends values.
    void baseAtSwitch;

    // True baseline: temporarily remove the version, snapshot, re-add.
    await prisma.accountCategoryMapping.delete({ where: { id: injected.id } });
    const trueBaseSwitch = await loadSnapshotExpense(snapInput, year, effectiveMonth);
    const trueBasePrior = hasPrior
      ? await loadSnapshotExpense(snapInput, year, priorMonth)
      : null;
    const reinjected = await prisma.accountCategoryMapping.create({
      data: {
        clientId,
        cont: CONT,
        scope: "contBase",
        categoryId: target.id,
        effectiveFrom: periodKey(year, effectiveMonth),
        effectiveTo: null,
      },
    });
    const injPrior = hasPrior
      ? await loadSnapshotExpense(snapInput, year, priorMonth)
      : null;

    // Switch month: amount leaves oldLabel, joins target, conserved.
    const outSwitch = itemValue(trueBaseSwitch, oldLabel) - itemValue(afterAtSwitch, oldLabel);
    const inSwitch = itemValue(afterAtSwitch, target.name) - itemValue(trueBaseSwitch, target.name);
    if (Math.abs(outSwitch - inSwitch) > 0.01 || Math.abs(outSwitch) < 0.01) {
      console.error(
        `  FAIL snapshot switch month ${year}-${effectiveMonth}: out=${outSwitch.toFixed(2)} in=${inSwitch.toFixed(2)}`
      );
      snapFailures++;
    }
    // Prior month: untouched.
    if (hasPrior && injPrior && trueBasePrior) {
      const dOld = itemValue(injPrior, oldLabel) - itemValue(trueBasePrior, oldLabel);
      const dNew = itemValue(injPrior, target.name) - itemValue(trueBasePrior, target.name);
      if (Math.abs(dOld) > 0.01 || Math.abs(dNew) > 0.01) {
        console.error(
          `  FAIL snapshot prior month ${year}-${priorMonth}: changed (dOld=${dOld.toFixed(2)} dNew=${dNew.toFixed(2)})`
        );
        snapFailures++;
      }
    }
    console.log(
      `Snapshot switch-month shift onto "${target.name}": ${inSwitch.toFixed(2)} lei` +
        (hasPrior ? ` · prior month ${year}-${priorMonth} untouched` : " · (no prior month in data)")
    );
    console.log(snapFailures === 0 ? "SNAPSHOT CHECKS (owner /firma): PASS" : `SNAPSHOT CHECKS: ${snapFailures} FAIL`);
    failures += snapFailures;
    // Normalize id var for the restore/cleanup below.
    injected.id = reinjected.id;

    // Restore + verify byte-equality to baseline.
    await prisma.accountCategoryMapping.delete({ where: { id: injected.id } });
    const restored = await loadLineTrends({ clientId, year, month, windowMonths: 12 });
    const restoredOk =
      JSON.stringify(restored.costExpense) === JSON.stringify(baseline.costExpense);
    console.log(restoredOk ? "RESTORE: PASS (identical to baseline)" : "RESTORE: FAIL");

    if (failures > 0 || !restoredOk) process.exitCode = 1;
  } finally {
    // Safety net: ensure the injected row is gone even if an assertion threw.
    await prisma.accountCategoryMapping.deleteMany({ where: { id: injected.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
