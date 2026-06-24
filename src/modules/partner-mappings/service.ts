/**
 * PartnerCategoryOverride service layer — pure CRUD against Prisma.
 *
 * No auth, no audit, no normalization done here — those concerns live in
 * actions.ts so this file stays mockable for unit tests and reusable from
 * background jobs.
 *
 * The caller is responsible for passing partnerNameNormalized through
 * src/lib/partner-normalize.ts BEFORE invoking these functions. We do not
 * re-normalize internally because we want every write path (manual / bulk /
 * suggested) to use the same canonical key.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  PartnerCategoryOverrideRow,
  PartnerOverrideSource,
} from "./types";
import { scopeToWindow, type MappingPeriodScope } from "@/lib/period";

/* -------------------------------------------------------------------------- */
/*                                    READ                                    */
/* -------------------------------------------------------------------------- */

/**
 * All overrides for one client across all conturi. Used by the loader to
 * build a lookup map (contBase → partner → categoryId) without N round-trips.
 */
export async function listOverridesForClient(
  prisma: PrismaClient,
  clientId: string
): Promise<PartnerCategoryOverrideRow[]> {
  const rows = await prisma.partnerCategoryOverride.findMany({
    where: { clientId, effectiveFrom: 0, effectiveTo: null, categoryId: { not: null } },
    orderBy: [{ contBase: "asc" }, { partnerNameNormalized: "asc" }],
  });
  return rows.map(toRow);
}

/**
 * Overrides for one specific cont. Used when opening the partner panel —
 * avoids loading the full client's overrides into memory when we only care
 * about one cont.
 */
export async function listOverridesForCont(
  prisma: PrismaClient,
  clientId: string,
  contBase: string
): Promise<PartnerCategoryOverrideRow[]> {
  const rows = await prisma.partnerCategoryOverride.findMany({
    where: { clientId, contBase, effectiveFrom: 0, effectiveTo: null, categoryId: { not: null } },
    orderBy: { partnerNameNormalized: "asc" },
  });
  return rows.map(toRow);
}

/* -------------------------------------------------------------------------- */
/*                                   WRITE                                    */
/* -------------------------------------------------------------------------- */

/**
 * Upsert one override. If a row already exists for (clientId, contBase,
 * partnerNameNormalized), update its categoryId + source + confirmedAt and
 * refresh partnerNameOriginal to the latest spelling we observed. Otherwise
 * insert a fresh row.
 *
 * Source semantics:
 *   - "manual" / "bulk" — confirmedAt set to now() implicitly (caller decides).
 *   - "suggested"       — confirmedAt left null (review queue picks it up).
 */
export async function upsertOverride(
  prisma: PrismaClient,
  input: {
    clientId: string;
    contBase: string;
    partnerNameNormalized: string;
    partnerNameOriginal: string;
    categoryId: string;
    source: PartnerOverrideSource;
    confirmedAt?: Date | null;
    periodScope?: MappingPeriodScope;
  }
): Promise<PartnerCategoryOverrideRow> {
  const confirmedAt =
    input.confirmedAt !== undefined
      ? input.confirmedAt
      : input.source === "suggested"
        ? null
        : new Date();

  const { effectiveFrom, effectiveTo } = scopeToWindow(input.periodScope);

  const row = await prisma.partnerCategoryOverride.upsert({
    where: {
      clientId_contBase_partnerNameNormalized_effectiveFrom: {
        clientId: input.clientId,
        contBase: input.contBase,
        partnerNameNormalized: input.partnerNameNormalized,
        effectiveFrom,
      },
    },
    create: {
      clientId: input.clientId,
      contBase: input.contBase,
      partnerNameNormalized: input.partnerNameNormalized,
      partnerNameOriginal: input.partnerNameOriginal,
      categoryId: input.categoryId,
      source: input.source,
      confirmedAt,
      effectiveFrom,
      effectiveTo,
    },
    update: {
      partnerNameOriginal: input.partnerNameOriginal,
      categoryId: input.categoryId,
      source: input.source,
      confirmedAt,
      effectiveTo,
    },
  });
  return toRow(row);
}

/**
 * Confirm a previously-suggested override without changing its category.
 * Used by the review queue: "Pastreaza" button on a sugestie just sets
 * confirmedAt + flips source to 'manual'.
 */
export async function confirmOverride(
  prisma: PrismaClient,
  id: string
): Promise<PartnerCategoryOverrideRow> {
  const row = await prisma.partnerCategoryOverride.update({
    where: { id },
    data: { confirmedAt: new Date(), source: "manual" },
  });
  return toRow(row);
}

/**
 * Delete one override — the partner reverts to the cont's default category.
 */
export async function deleteOverride(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  await prisma.partnerCategoryOverride.delete({ where: { id } });
}

/* -------------------------------------------------------------------------- */
/*                              BULK OPERATIONS                               */
/* -------------------------------------------------------------------------- */

/**
 * Bulk-apply one category to a list of partner keys on a cont. Used by the
 * "Aplica la toti partenerii nemapati" button (Sprint 3) and by the
 * suggestion pre-fill (Sprint 4).
 *
 * - skipExistingOverrides=true (default) — partners that already have an
 *   override are LEFT ALONE. Matches the §11 promise that bulk never blindly
 *   overwrites a manual exception.
 * - skipExistingOverrides=false — overwrites everything (rarely useful, kept
 *   for completeness).
 *
 * Returns the number of rows created/updated and the number of partners
 * skipped because they already had an override.
 */
export async function bulkApplyOverrides(
  prisma: PrismaClient,
  input: {
    clientId: string;
    contBase: string;
    categoryId: string;
    source: PartnerOverrideSource;
    partners: { nameNormalized: string; nameOriginal: string }[];
    skipExistingOverrides?: boolean;
  }
): Promise<{ applied: number; skipped: number }> {
  const skipExisting = input.skipExistingOverrides ?? true;

  // Discover which partner keys already have a row so we can either skip
  // (default) or include them in the overwrite.
  const existing = await prisma.partnerCategoryOverride.findMany({
    where: {
      clientId: input.clientId,
      contBase: input.contBase,
      effectiveFrom: 0,
      partnerNameNormalized: { in: input.partners.map((p) => p.nameNormalized) },
    },
    select: { partnerNameNormalized: true },
  });
  const existingSet = new Set(existing.map((r) => r.partnerNameNormalized));

  const targets = skipExisting
    ? input.partners.filter((p) => !existingSet.has(p.nameNormalized))
    : input.partners;

  const confirmedAt = input.source === "suggested" ? null : new Date();

  // Use Promise.all of upserts — Prisma doesn't support batched upserts in a
  // single query. Volume here is bounded by partners-on-a-cont so this is
  // O(N) with small N (rarely >200).
  await Promise.all(
    targets.map((p) =>
      prisma.partnerCategoryOverride.upsert({
        where: {
          clientId_contBase_partnerNameNormalized_effectiveFrom: {
            clientId: input.clientId,
            contBase: input.contBase,
            partnerNameNormalized: p.nameNormalized,
            effectiveFrom: 0,
          },
        },
        create: {
          clientId: input.clientId,
          contBase: input.contBase,
          partnerNameNormalized: p.nameNormalized,
          partnerNameOriginal: p.nameOriginal,
          categoryId: input.categoryId,
          source: input.source,
          confirmedAt,
        },
        update: {
          partnerNameOriginal: p.nameOriginal,
          categoryId: input.categoryId,
          source: input.source,
          confirmedAt,
        },
      })
    )
  );

  return { applied: targets.length, skipped: input.partners.length - targets.length };
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function toRow(
  row: Awaited<
    ReturnType<PrismaClient["partnerCategoryOverride"]["findFirst"]>
  > & object
): PartnerCategoryOverrideRow {
  return {
    id: row.id,
    clientId: row.clientId,
    contBase: row.contBase,
    partnerNameNormalized: row.partnerNameNormalized,
    partnerNameOriginal: row.partnerNameOriginal,
    categoryId: row.categoryId as string,
    source: row.source as PartnerOverrideSource,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
