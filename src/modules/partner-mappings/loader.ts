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
  computePartnerCategoryAdjustments,
  type ContKind,
  type JournalLineForAggregation,
  type PartnerAggregationResult,
  type PartnerCategoryAdjustment,
  type PartnerLobAllocationInput,
  type PartnerSummary,
} from "./aggregator";
import {
  listOverridesForClient,
  listOverridesForCont,
} from "./service";
import type {
  PartnerCategoryOverrideRow,
  PartnerOverrideSource,
} from "./types";

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
 *
 * Uses $queryRaw to bypass Prisma's per-row ORM hydration — `suma` is cast
 * to text in SQL and parsed once with Number() at the boundary. Same pattern
 * as balances/service.ts::getActiveEntries; measured 5-10x speedup over
 * findMany on hot reads.
 */
interface RawCostRevenueRow {
  contD: string;
  contDBase: string;
  contC: string;
  contCBase: string;
  suma: string;
}

async function fetchLinesForCont(
  prisma: PrismaClient,
  clientId: string,
  contBase: string,
  kind: ContKind,
  year: number,
  month: number
): Promise<JournalLineForAggregation[]> {
  const rows =
    kind === "expense"
      ? await prisma.$queryRaw<RawCostRevenueRow[]>`
          SELECT "contD", "contDBase", "contC", "contCBase", suma::text AS suma
          FROM "JournalLine"
          WHERE "clientId" = ${clientId}
            AND "contDBase" = ${contBase}
            AND year = ${year}
            AND month <= ${month}
            AND "deletedAt" IS NULL
        `
      : await prisma.$queryRaw<RawCostRevenueRow[]>`
          SELECT "contD", "contDBase", "contC", "contCBase", suma::text AS suma
          FROM "JournalLine"
          WHERE "clientId" = ${clientId}
            AND "contCBase" = ${contBase}
            AND year = ${year}
            AND month <= ${month}
            AND "deletedAt" IS NULL
        `;

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
 *
 * On a 200k-row client this can pull 30-80k rows; ORM hydration was the
 * dominant cost (~600-900 ms). $queryRaw collapses to plain JS objects
 * and stays in the index-scan path for `(clientId, year, month)`.
 */
async function fetchAllCostAndRevenueLines(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
): Promise<JournalLineForAggregation[]> {
  const rows = await prisma.$queryRaw<RawCostRevenueRow[]>`
    SELECT "contD", "contDBase", "contC", "contCBase", suma::text AS suma
    FROM "JournalLine"
    WHERE "clientId" = ${clientId}
      AND year = ${year}
      AND month <= ${month}
      AND "deletedAt" IS NULL
      AND ("contDBase" LIKE '6%' OR "contCBase" LIKE '7%')
  `;

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
  // Called by four loaders per Mapari render — switch to $queryRaw so we
  // pay zero ORM cost. JournalPartner is small (~hundreds of rows) but
  // every ms counts when the same data is fetched repeatedly.
  const rows = await prisma.$queryRaw<
    Array<{ analyticAccount: string; partnerName: string | null }>
  >`
    SELECT "analyticAccount", "partnerName"
    FROM "JournalPartner"
    WHERE "clientId" = ${clientId}
  `;
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
  month: number,
  /** Partner line-of-business pins (from @/modules/verticals), used to
   *  compute per-cont pinned amounts in the same aggregation pass. Keyed by
   *  contBase by the caller-agnostic `contBase` field on each row. */
  lobAllocations: Array<
    PartnerLobAllocationInput & { contBase: string }
  > = []
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

  const lobByContBase = new Map<string, PartnerLobAllocationInput[]>();
  for (const alloc of lobAllocations) {
    const bucket = lobByContBase.get(alloc.contBase);
    if (bucket) bucket.push(alloc);
    else lobByContBase.set(alloc.contBase, [alloc]);
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
      allOverrides,
      lobByContBase.get(contBase) ?? []
    );
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                       SUGGESTION QUEUE (Sprint 5)                          */
/* -------------------------------------------------------------------------- */

export interface SuggestionQueueItem {
  contBase: string;
  contKind: ContKind;
  partnerNameOriginal: string;
  partnerNameNormalized: string;
  /** YTD rulaj for this partner on this cont. Sort key — biggest first. */
  rulaj: number;
  suggestedCategoryId: string;
  /** Other contBases where the same partner has overrides at this same
   *  category — the reasoning we surface to the contabil
   *  ('Pentru ca: pe conturile X, Y, partenerul a fost mapat la Z'). */
  reasonContBases: string[];
}

/**
 * Build the cross-cont review queue: every partner with a suggestion,
 * across every cont, in one flat list sorted by rulaj DESC. Drives the
 * Sprint 5 review-queue mini-flow.
 */
export async function loadSuggestionQueue(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
): Promise<SuggestionQueueItem[]> {
  const [allLines, partnerNames, allOverrides] = await Promise.all([
    fetchAllCostAndRevenueLines(prisma, clientId, year, month),
    fetchPartnerNames(prisma, clientId),
    listOverridesForClient(prisma, clientId),
  ]);

  // Same line/override bucketing as the summary path.
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

  const overridesByContBase = new Map<string, typeof allOverrides>();
  for (const o of allOverrides) {
    const bucket = overridesByContBase.get(o.contBase);
    if (bucket) bucket.push(o);
    else overridesByContBase.set(o.contBase, [o]);
  }

  // Pre-index overrides by partnerNameNormalized for reason-collection.
  const overridesByPartner = new Map<string, typeof allOverrides>();
  for (const o of allOverrides) {
    const bucket = overridesByPartner.get(o.partnerNameNormalized);
    if (bucket) bucket.push(o);
    else overridesByPartner.set(o.partnerNameNormalized, [o]);
  }

  const queue: SuggestionQueueItem[] = [];
  for (const [contBase, lines] of linesByContBase) {
    const kind = kindForContBase(contBase);
    if (!kind) continue;
    const overridesForCont = overridesByContBase.get(contBase) ?? [];
    const { partners } = aggregatePartnersForCont(
      kind,
      lines,
      partnerNames,
      overridesForCont,
      allOverrides
    );
    for (const p of partners) {
      if (p.override !== null || p.suggestedCategoryId === null) continue;
      // Collect the reasoning: which OTHER conts contributed an override
      // for the same partner at the suggested category.
      const reasonContBases =
        overridesByPartner
          .get(p.nameNormalized)
          ?.filter(
            (o) =>
              o.contBase !== contBase &&
              o.categoryId === p.suggestedCategoryId
          )
          .map((o) => o.contBase) ?? [];

      queue.push({
        contBase,
        contKind: kind,
        partnerNameOriginal: p.nameOriginal,
        partnerNameNormalized: p.nameNormalized,
        rulaj: p.rulaj,
        suggestedCategoryId: p.suggestedCategoryId,
        reasonContBases,
      });
    }
  }

  // Sort DESC by rulaj — biggest impact first. The contabil handles the
  // 12.000 lei suggestion before the 100 lei one.
  queue.sort((a, b) => b.rulaj - a.rulaj);
  return queue;
}

/* -------------------------------------------------------------------------- */
/*                  ALL-EXCEPTIONS VIEW (centralised list)                    */
/* -------------------------------------------------------------------------- */

/**
 * One row in the centralised "Toate exceptiile" view — every override the
 * contabil has set across the whole firm, enriched with the rulaj observed
 * on that (cont, partner) pair in the selected period plus the partner's
 * display name.
 *
 * The contabil opens this from the Mapari Cashflow header when they want
 * to inspect every manual exception in one place — find a partner across
 * multiple conts, change a category in bulk, or just audit "what overrides
 * have we accumulated?".
 */
export interface AllExceptionsRow {
  /** PartnerCategoryOverride.id — used by Delete/Update actions. */
  overrideId: string;
  /** Cont where the override is anchored. */
  contBase: string;
  /** "expense" / "revenue" — derived from contBase. */
  contKind: ContKind;
  /** Partner display name. The "Original" spelling we keep in the journal. */
  partnerNameOriginal: string;
  /** Normalised matching key. */
  partnerNameNormalized: string;
  /** Override target category. */
  categoryId: string;
  /** Where the override came from (manual / bulk / suggested). */
  source: PartnerOverrideSource;
  /** Whether the contabil has explicitly confirmed it. Sprint 5 flow. */
  confirmedAt: Date | null;
  /** YTD rulaj of THIS partner on THIS cont in the selected period.
   *  Drives sort order in the centralised view (biggest impact first).
   *  Can be 0 if the partner had no activity this period (historical
   *  override that's idle). */
  rulaj: number;
}

/**
 * Centralised "every exception in one place" loader. The output is sorted
 * by rulaj DESC so the biggest-impact overrides are at the top.
 *
 * Note: an override can exist for a (cont, partner) pair that had no
 * activity in the selected period — we still surface it with rulaj=0 so
 * the contabil can see and clean up historical overrides that are no
 * longer relevant.
 */
export async function loadAllExceptions(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
): Promise<AllExceptionsRow[]> {
  const [allLines, partnerNames, allOverrides] = await Promise.all([
    fetchAllCostAndRevenueLines(prisma, clientId, year, month),
    fetchPartnerNames(prisma, clientId),
    listOverridesForClient(prisma, clientId),
  ]);

  // Bucket lines by contBase so we can compute rulaj per (cont, partner).
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

  // Pre-compute partner rulaj for each (cont, partner-normalized) by reusing
  // the same aggregator. We discard the partners that aren't overrides — the
  // override list IS the source of truth here.
  const rulajByContPartner = new Map<string, number>();
  for (const [contBase, lines] of linesByContBase) {
    const kind = kindForContBase(contBase);
    if (!kind) continue;
    const overridesForCont = allOverrides.filter((o) => o.contBase === contBase);
    const { partners } = aggregatePartnersForCont(
      kind,
      lines,
      partnerNames,
      overridesForCont,
      []
    );
    for (const p of partners) {
      rulajByContPartner.set(`${contBase}|${p.nameNormalized}`, p.rulaj);
    }
  }

  const rows: AllExceptionsRow[] = allOverrides.map((o) => {
    const kind = kindForContBase(o.contBase);
    const rulaj =
      rulajByContPartner.get(`${o.contBase}|${o.partnerNameNormalized}`) ?? 0;
    return {
      overrideId: o.id,
      contBase: o.contBase,
      // contKind defaults to expense for unknown — should never happen
      // because PartnerCategoryOverride.contBase is always 6xx/7xx, but
      // the type-safety fallback keeps TS happy.
      contKind: kind ?? "expense",
      partnerNameOriginal: o.partnerNameOriginal,
      partnerNameNormalized: o.partnerNameNormalized,
      categoryId: o.categoryId,
      source: o.source,
      confirmedAt: o.confirmedAt,
      rulaj,
    };
  });

  // Sort by absolute rulaj DESC. The 12.000 lei exception is more important
  // to inspect than the 5 lei one — show it first.
  rows.sort((a, b) => Math.abs(b.rulaj) - Math.abs(a.rulaj));
  return rows;
}

/**
 * Public helper: compute the PartnerCategoryAdjustment[] for a client's YTD
 * period. Used by both the owner snapshot and the Mapari Cashflow loader to
 * surface the residue rule consistently.
 *
 * Fast-path: returns [] without any DB hit when there are no overrides.
 */
export async function loadPartnerCategoryAdjustments(
  prisma: PrismaClient,
  clientId: string,
  year: number,
  month: number
): Promise<PartnerCategoryAdjustment[]> {
  const overrides = await listOverridesForClient(prisma, clientId);
  if (overrides.length === 0) return [];

  const [lines, partnerNames] = await Promise.all([
    fetchAllCostAndRevenueLines(prisma, clientId, year, month),
    fetchPartnerNames(prisma, clientId),
  ]);

  return computePartnerCategoryAdjustments(lines, partnerNames, overrides);
}
