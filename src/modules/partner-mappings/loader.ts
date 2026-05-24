/**
 * Loader for partner-level data. Two entry points:
 *
 *   loadPartnersForCont(clientId, contBase, year, month)
 *     Full PartnerEntry[] for one cont. Used by the slide-panel when it
 *     opens for a specific cont. Returns the partners with attached
 *     overrides, plus the unresolved rulaj (lines where we couldn't
 *     identify a partner — usually TVA, dobanzi, internal transfers).
 *
 *   loadPartnerSummariesForClient(clientId, year, month)
 *     Lightweight per-cont summary for the main listing. Only counts +
 *     sums, no partner detail. Drives the per-cont coverage bars and the
 *     "[Vezi parteneri →]" badge ("48 parteneri · 65%") without loading
 *     full partner detail into the page bundle.
 */
import type { PrismaClient } from "@prisma/client";
import {
  aggregatePartnersForCont,
  summarizePartnersForCont,
  type ContKind,
  type JournalLineForAggregation,
  type PartnerAggregationResult,
  type PartnerSummary,
} from "./aggregator";
import {
  listOverridesForClient,
  listOverridesForCont,
} from "./service";
import type { PartnerCategoryOverrideRow } from "./types";

function kindForContBase(contBase: string): ContKind | null {
  const first = contBase.charAt(0);
  if (first === "6") return "expense";
  if (first === "7") return "revenue";
  return null;
}

/**
 * Pull every journal line that touches a given contBase in the YTD window
 * (months 1..month inside year). For an expense cont we look at contDBase;
 * for revenue, contCBase. Deleted lines are excluded.
 */
async function fetchLinesForCont(
  prisma: PrismaClient,
  clientId: string,
  contBase: string,
  kind: ContKind,
  year: number,
  month: number
): Promise<JournalLineForAggregation[]> {
  const where =
    kind === "expense"
      ? {
          clientId,
          contDBase: contBase,
          year,
          month: { lte: month },
          deletedAt: null,
        }
      : {
          clientId,
          contCBase: contBase,
          year,
          month: { lte: month },
          deletedAt: null,
        };

  const rows = await prisma.journalLine.findMany({
    where,
    select: {
      contD: true,
      contDBase: true,
      contC: true,
      contCBase: true,
      suma: true,
    },
  });

  return rows.map((r) => ({
    contD: r.contD,
    contDBase: r.contDBase,
    contC: r.contC,
    contCBase: r.contCBase,
    suma: Number(r.suma),
  }));
}

/**
 * Same shape as fetchLinesForCont but returns ALL class-6 and class-7 lines
 * for the client in the YTD window. Used by loadPartnerSummariesForClient
 * to compute all per-cont summaries in a single query rather than N+1.
 */
async function fetchAllCostAndRevenueLines(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
): Promise<JournalLineForAggregation[]> {
  const rows = await prisma.journalLine.findMany({
    where: {
      clientId,
      year,
      month: { lte: month },
      deletedAt: null,
      OR: [
        { contDBase: { startsWith: "6" } },
        { contCBase: { startsWith: "7" } },
      ],
    },
    select: {
      contD: true,
      contDBase: true,
      contC: true,
      contCBase: true,
      suma: true,
    },
  });

  return rows.map((r) => ({
    contD: r.contD,
    contDBase: r.contDBase,
    contC: r.contC,
    contCBase: r.contCBase,
    suma: Number(r.suma),
  }));
}

async function fetchPartnerNames(
  prisma: PrismaClient,
  clientId: string
): Promise<Map<string, string>> {
  const rows = await prisma.journalPartner.findMany({
    where: { clientId },
    select: { analyticAccount: true, partnerName: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.partnerName && r.partnerName.trim() !== "") {
      map.set(r.analyticAccount, r.partnerName.trim());
    }
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/*                            PUBLIC API                                      */
/* -------------------------------------------------------------------------- */

export async function loadPartnersForCont(
  prisma: PrismaClient,
  clientId: string,
  contBase: string,
  year: number,
  month: number
): Promise<PartnerAggregationResult> {
  const kind = kindForContBase(contBase);
  if (!kind) {
    return { partners: [], partnerRulaj: 0, unresolvedRulaj: 0 };
  }

  // Sprint 4: fetch ALL client overrides (not just this cont's) so the
  // aggregator can compute cross-cont suggestions for partners who appear
  // here for the first time but have been classified elsewhere. The
  // aggregator splits them internally — overrides on this cont attach
  // directly, overrides on other conts feed the suggestion index.
  const [lines, partnerNames, allOverrides] = await Promise.all([
    fetchLinesForCont(prisma, clientId, contBase, kind, year, month),
    fetchPartnerNames(prisma, clientId),
    listOverridesForClient(prisma, clientId),
  ]);
  const overridesForCont = allOverrides.filter((o) => o.contBase === contBase);

  return aggregatePartnersForCont(
    kind,
    lines,
    partnerNames,
    overridesForCont,
    allOverrides
  );
}

/**
 * Single-pass per-cont summary for every 6xx/7xx contBase in the client's
 * journal for the period. Drives the per-cont coverage bars in the main
 * Mapari Cashflow listing.
 *
 * Returns Record<contBase, PartnerSummary> so it serializes naturally across
 * the server/client boundary in RSC (Maps don't serialize cleanly).
 */
export async function loadPartnerSummariesForClient(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
): Promise<Record<string, PartnerSummary>> {
  const [allLines, partnerNames, allOverrides] = await Promise.all([
    fetchAllCostAndRevenueLines(prisma, clientId, year, month),
    fetchPartnerNames(prisma, clientId),
    listOverridesForClient(prisma, clientId),
  ]);

  // Bucket lines by the cost/revenue cont (the 6xx/7xx side). One line
  // touches exactly one such cont in our query, so we pick whichever side
  // matched and bucket there.
  const linesByContBase = new Map<string, JournalLineForAggregation[]>();
  for (const line of allLines) {
    const contBase = line.contDBase.startsWith("6")
      ? line.contDBase
      : line.contCBase.startsWith("7")
        ? line.contCBase
        : null;
    if (!contBase) continue;
    const bucket = linesByContBase.get(contBase);
    if (bucket) bucket.push(line);
    else linesByContBase.set(contBase, [line]);
  }

  // Bucket overrides by contBase for O(1) lookup.
  const overridesByContBase = new Map<string, PartnerCategoryOverrideRow[]>();
  for (const o of allOverrides) {
    const bucket = overridesByContBase.get(o.contBase);
    if (bucket) bucket.push(o);
    else overridesByContBase.set(o.contBase, [o]);
  }

  // Union of conts that have either journal activity OR overrides — an
  // override-only cont (no journal lines this period) still needs a summary
  // so the UI can show "the historical mapping exists but the partner was
  // idle this year".
  const allContBases = new Set<string>([
    ...linesByContBase.keys(),
    ...overridesByContBase.keys(),
  ]);

  const result: Record<string, PartnerSummary> = {};
  for (const contBase of allContBases) {
    const kind = kindForContBase(contBase);
    if (!kind) continue;
    const lines = linesByContBase.get(contBase) ?? [];
    const overrides = overridesByContBase.get(contBase) ?? [];
    result[contBase] = summarizePartnersForCont(
      kind,
      lines,
      partnerNames,
      overrides,
      allOverrides
    );
  }

  return result;
}
