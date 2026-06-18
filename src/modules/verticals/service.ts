/**
 * Vertical + VerticalAllocation service layer.
 *
 * Functions are pure CRUD against Prisma. Auth and audit live in actions.ts
 * — keep this file mockable for unit tests and reusable from background jobs.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import type {
  AllocationScope,
  AllocationSplit,
  AllocationView,
  CategoryAllocationView,
  PartnerAllocationView,
  VerticalView,
} from "./types";

const DEFAULT_VERTICAL_NAME = "Toata firma";
const MAX_SPLITS_PER_ALLOCATION = 5;

/* -------------------------------------------------------------------------- */
/*                                ACTIVATION                                  */
/* -------------------------------------------------------------------------- */

/**
 * Flip `verticalsEnabled` on a client. When turning ON for the first time,
 * also create the default "Toata firma" vertical so allocations always have a
 * fallback target. Idempotent.
 */
export async function enableVerticals(
  prisma: PrismaClient,
  clientId: string
): Promise<{ enabled: true; defaultVerticalId: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, verticalsEnabled: true },
  });
  if (!client) throw new Error("Firma nu exista");

  if (!client.verticalsEnabled) {
    await prisma.client.update({
      where: { id: clientId },
      data: { verticalsEnabled: true },
    });
  }

  let def = await prisma.vertical.findFirst({
    where: { clientId, isDefault: true },
    select: { id: true },
  });
  if (!def) {
    const created = await prisma.vertical.create({
      data: {
        clientId,
        name: DEFAULT_VERTICAL_NAME,
        position: 0,
        isDefault: true,
      },
      select: { id: true },
    });
    def = created;
  }

  return { enabled: true, defaultVerticalId: def.id };
}

/**
 * Soft-disable. We do NOT delete verticals or allocations — the user might
 * want to re-enable next month. UI is fully hidden when the flag is off.
 */
export async function disableVerticals(
  prisma: PrismaClient,
  clientId: string
): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: { verticalsEnabled: false },
  });
}

/* -------------------------------------------------------------------------- */
/*                                VERTICALS                                   */
/* -------------------------------------------------------------------------- */

export async function listVerticals(
  prisma: PrismaClient,
  clientId: string
): Promise<VerticalView[]> {
  const verticals = await prisma.vertical.findMany({
    where: { clientId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  // Allocation counts: a vertical is referenced inside a split JSON. Postgres
  // can do this in SQL but a small in-memory aggregation keeps the code simple
  // and is fine at the scale of typical client (<= ~500 allocations).
  const allocations = await prisma.verticalAllocation.findMany({
    where: { clientId },
    select: { splits: true },
  });
  const counts = new Map<string, number>();
  for (const a of allocations) {
    const splits = parseSplits(a.splits);
    const seen = new Set<string>();
    for (const s of splits) {
      if (s.percent > 0 && !seen.has(s.verticalId)) {
        seen.add(s.verticalId);
        counts.set(s.verticalId, (counts.get(s.verticalId) ?? 0) + 1);
      }
    }
  }

  return verticals.map((v) => ({
    id: v.id,
    clientId: v.clientId,
    name: v.name,
    position: v.position,
    isDefault: v.isDefault,
    allocationCount: counts.get(v.id) ?? 0,
  }));
}

export interface CreateVerticalInput {
  clientId: string;
  name: string;
  position?: number;
}

export async function createVertical(
  prisma: PrismaClient,
  input: CreateVerticalInput
) {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("Numele verticalei nu poate fi gol");
  if (name.length > 60) throw new Error("Numele este prea lung (max 60 caractere)");

  const position =
    input.position ??
    (await prisma.vertical.count({ where: { clientId: input.clientId } }));

  return prisma.vertical.create({
    data: { clientId: input.clientId, name, position, isDefault: false },
  });
}

export async function renameVertical(
  prisma: PrismaClient,
  clientId: string,
  verticalId: string,
  newName: string
) {
  const name = newName.trim();
  if (name.length === 0) throw new Error("Numele nu poate fi gol");
  if (name.length > 60) throw new Error("Numele este prea lung (max 60 caractere)");

  const existing = await prisma.vertical.findFirst({
    where: { id: verticalId, clientId },
  });
  if (!existing) throw new Error("Verticala nu exista pentru aceasta firma");

  return prisma.vertical.update({
    where: { id: verticalId },
    data: { name },
  });
}

export async function deleteVertical(
  prisma: PrismaClient,
  clientId: string,
  verticalId: string
) {
  const existing = await prisma.vertical.findFirst({
    where: { id: verticalId, clientId },
  });
  if (!existing) throw new Error("Verticala nu exista pentru aceasta firma");
  if (existing.isDefault) {
    throw new Error(
      "Nu poti sterge verticala implicita. Poti doar sa o redenumesti."
    );
  }

  // Find allocations that reference this vertical in their splits and rewrite
  // them: if removing leaves zero splits, delete the allocation entirely
  // (the cont falls back to default). Otherwise, the remaining splits get
  // renormalized so they sum to 100.
  const allocations = await prisma.verticalAllocation.findMany({
    where: { clientId },
  });
  for (const allocation of allocations) {
    const splits = parseSplits(allocation.splits);
    const filtered = splits.filter((s) => s.verticalId !== verticalId);
    if (filtered.length === splits.length) continue; // no reference

    if (filtered.length === 0) {
      await prisma.verticalAllocation.delete({ where: { id: allocation.id } });
      continue;
    }
    const total = filtered.reduce((s, x) => s + x.percent, 0);
    const renormalized = renormalizeSplits(filtered, total);
    await prisma.verticalAllocation.update({
      where: { id: allocation.id },
      data: {
        splits: renormalized as unknown as Prisma.InputJsonValue,
        primaryVerticalId: renormalized[0]?.verticalId ?? null,
      },
    });
  }

  // Same renormalization treatment for category-level allocations referencing
  // this vertical: drop the slice, renormalize the remainder; delete the row
  // entirely if no splits remain.
  const categoryAllocations = await prisma.categoryVerticalAllocation.findMany({
    where: { clientId },
  });
  for (const allocation of categoryAllocations) {
    const splits = parseSplits(allocation.splits);
    const filtered = splits.filter((s) => s.verticalId !== verticalId);
    if (filtered.length === splits.length) continue;

    if (filtered.length === 0) {
      await prisma.categoryVerticalAllocation.delete({
        where: { id: allocation.id },
      });
      continue;
    }
    const total = filtered.reduce((s, x) => s + x.percent, 0);
    const renormalized = renormalizeSplits(filtered, total);
    await prisma.categoryVerticalAllocation.update({
      where: { id: allocation.id },
      data: {
        splits: renormalized as unknown as Prisma.InputJsonValue,
        primaryVerticalId: renormalized[0]?.verticalId ?? null,
      },
    });
  }

  // Partner-level allocations referencing this vertical: same drop +
  // renormalize treatment as cont/category allocations.
  const partnerAllocs = await prisma.partnerVerticalAllocation.findMany({
    where: { clientId },
  });
  for (const allocation of partnerAllocs) {
    const splits = parseSplits(allocation.splits);
    const filtered = splits.filter((s) => s.verticalId !== verticalId);
    if (filtered.length === splits.length) continue;
    if (filtered.length === 0) {
      await prisma.partnerVerticalAllocation.delete({ where: { id: allocation.id } });
      continue;
    }
    const total = filtered.reduce((s, x) => s + x.percent, 0);
    const renormalized = renormalizeSplits(filtered, total);
    await prisma.partnerVerticalAllocation.update({
      where: { id: allocation.id },
      data: {
        splits: renormalized as unknown as Prisma.InputJsonValue,
        primaryVerticalId: renormalized[0]?.verticalId ?? null,
      },
    });
  }

  // Firm-top default split: same drop-and-renormalize treatment.
  const firmDefault = await prisma.firmVerticalDefault.findUnique({
    where: { clientId },
  });
  if (firmDefault) {
    const splits = parseSplits(firmDefault.splits);
    const filtered = splits.filter((s) => s.verticalId !== verticalId);
    if (filtered.length !== splits.length) {
      if (filtered.length === 0) {
        await prisma.firmVerticalDefault.delete({ where: { clientId } });
      } else {
        const total = filtered.reduce((s, x) => s + x.percent, 0);
        await prisma.firmVerticalDefault.update({
          where: { clientId },
          data: {
            splits: renormalizeSplits(filtered, total) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  await prisma.vertical.delete({ where: { id: verticalId } });
  return existing;
}

/* -------------------------------------------------------------------------- */
/*                              ALLOCATIONS                                   */
/* -------------------------------------------------------------------------- */

export async function listAllocations(
  prisma: PrismaClient,
  clientId: string
): Promise<AllocationView[]> {
  const rows = await prisma.verticalAllocation.findMany({
    where: { clientId },
  });
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    scope: r.scope as AllocationScope,
    cont: r.cont,
    splits: parseSplits(r.splits),
  }));
}

export interface SetAllocationInput {
  clientId: string;
  scope: AllocationScope;
  cont: string;
  splits: AllocationSplit[];
}

/**
 * Create or update the allocation for one (clientId, cont). Validation:
 *   - 1..5 splits,
 *   - integer percent in 1..100,
 *   - sum(percent) === 100,
 *   - all verticalIds exist and belong to this client.
 *
 * Upsert behavior is intentional: setting an empty splits[] is rejected — to
 * remove an allocation use clearAllocation() so the audit row is unambiguous.
 */
export async function setAllocation(
  prisma: PrismaClient,
  input: SetAllocationInput
) {
  validateSplits(input.splits);

  // All vertical ids must belong to this client.
  const vIds = Array.from(new Set(input.splits.map((s) => s.verticalId)));
  const verticals = await prisma.vertical.findMany({
    where: { clientId: input.clientId, id: { in: vIds } },
    select: { id: true },
  });
  if (verticals.length !== vIds.length) {
    throw new Error("Una sau mai multe verticale nu apartin acestei firme");
  }

  return prisma.verticalAllocation.upsert({
    where: {
      clientId_cont: { clientId: input.clientId, cont: input.cont },
    },
    create: {
      clientId: input.clientId,
      scope: input.scope,
      cont: input.cont,
      splits: input.splits as unknown as Prisma.InputJsonValue,
      primaryVerticalId: input.splits[0].verticalId,
    },
    update: {
      scope: input.scope,
      splits: input.splits as unknown as Prisma.InputJsonValue,
      primaryVerticalId: input.splits[0].verticalId,
    },
  });
}

export async function clearAllocation(
  prisma: PrismaClient,
  clientId: string,
  cont: string
) {
  const existing = await prisma.verticalAllocation.findFirst({
    where: { clientId, cont },
  });
  if (!existing) return null;

  await prisma.verticalAllocation.delete({ where: { id: existing.id } });
  return existing;
}

/* -------------------------------------------------------------------------- */
/*                         CATEGORY-LEVEL ALLOCATIONS                         */
/* -------------------------------------------------------------------------- */

/**
 * Category-level allocations route partner-override residue to the right
 * lines of business. They share validation rules with cont-level allocations
 * (1..5 splits, integer percents summing to 100, verticals belong to client)
 * but key by categoryId, not cont.
 */
export async function listCategoryAllocations(
  prisma: PrismaClient,
  clientId: string
): Promise<CategoryAllocationView[]> {
  const rows = await prisma.categoryVerticalAllocation.findMany({
    where: { clientId },
  });
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    categoryId: r.categoryId,
    splits: parseSplits(r.splits),
  }));
}

export interface SetCategoryAllocationInput {
  clientId: string;
  categoryId: string;
  splits: AllocationSplit[];
}

export async function setCategoryAllocation(
  prisma: PrismaClient,
  input: SetCategoryAllocationInput
) {
  validateSplits(input.splits);

  const vIds = Array.from(new Set(input.splits.map((s) => s.verticalId)));
  const verticals = await prisma.vertical.findMany({
    where: { clientId: input.clientId, id: { in: vIds } },
    select: { id: true },
  });
  if (verticals.length !== vIds.length) {
    throw new Error("Una sau mai multe verticale nu apartin acestei firme");
  }

  const category = await prisma.costCategory.findFirst({
    where: { id: input.categoryId, clientId: input.clientId },
    select: { id: true },
  });
  if (!category) {
    throw new Error("Linia de cost nu exista pentru aceasta firma");
  }

  return prisma.categoryVerticalAllocation.upsert({
    where: { categoryId: input.categoryId },
    create: {
      clientId: input.clientId,
      categoryId: input.categoryId,
      splits: input.splits as unknown as Prisma.InputJsonValue,
      primaryVerticalId: input.splits[0].verticalId,
    },
    update: {
      splits: input.splits as unknown as Prisma.InputJsonValue,
      primaryVerticalId: input.splits[0].verticalId,
    },
  });
}

export async function clearCategoryAllocation(
  prisma: PrismaClient,
  clientId: string,
  categoryId: string
) {
  const existing = await prisma.categoryVerticalAllocation.findFirst({
    where: { clientId, categoryId },
  });
  if (!existing) return null;

  await prisma.categoryVerticalAllocation.delete({ where: { id: existing.id } });
  return existing;
}

/* -------------------------------------------------------------------------- */
/*                        PARTNER-LEVEL ALLOCATIONS                           */
/* -------------------------------------------------------------------------- */

/**
 * Partner-level line-of-business split — the most specific level of the LOB
 * cascade (partener > cont > categorie > firma). Keyed by
 * (clientId, contBase, partnerNameNormalized). Absent = the partener inherits
 * the cont's resolved split. Shares split validation with every other level.
 */
export async function listPartnerAllocations(
  prisma: PrismaClient,
  clientId: string,
  contBase?: string
): Promise<PartnerAllocationView[]> {
  const rows = await prisma.partnerVerticalAllocation.findMany({
    where: contBase ? { clientId, contBase } : { clientId },
  });
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    contBase: r.contBase,
    partnerNameNormalized: r.partnerNameNormalized,
    partnerNameOriginal: r.partnerNameOriginal,
    splits: parseSplits(r.splits),
  }));
}

export interface SetPartnerAllocationInput {
  clientId: string;
  contBase: string;
  partnerNameNormalized: string;
  partnerNameOriginal: string;
  splits: AllocationSplit[];
}

export async function setPartnerAllocation(
  prisma: PrismaClient,
  input: SetPartnerAllocationInput
) {
  validateSplits(input.splits);
  const vIds = Array.from(new Set(input.splits.map((s) => s.verticalId)));
  const verticals = await prisma.vertical.findMany({
    where: { clientId: input.clientId, id: { in: vIds } },
    select: { id: true },
  });
  if (verticals.length !== vIds.length) {
    throw new Error("Una sau mai multe linii de business nu apartin acestei firme");
  }

  return prisma.partnerVerticalAllocation.upsert({
    where: {
      clientId_contBase_partnerNameNormalized: {
        clientId: input.clientId,
        contBase: input.contBase,
        partnerNameNormalized: input.partnerNameNormalized,
      },
    },
    create: {
      clientId: input.clientId,
      contBase: input.contBase,
      partnerNameNormalized: input.partnerNameNormalized,
      partnerNameOriginal: input.partnerNameOriginal,
      splits: input.splits as unknown as Prisma.InputJsonValue,
      primaryVerticalId: input.splits[0].verticalId,
    },
    update: {
      partnerNameOriginal: input.partnerNameOriginal,
      splits: input.splits as unknown as Prisma.InputJsonValue,
      primaryVerticalId: input.splits[0].verticalId,
    },
  });
}

export async function clearPartnerAllocation(
  prisma: PrismaClient,
  clientId: string,
  contBase: string,
  partnerNameNormalized: string
) {
  const existing = await prisma.partnerVerticalAllocation.findFirst({
    where: { clientId, contBase, partnerNameNormalized },
  });
  if (!existing) return null;
  await prisma.partnerVerticalAllocation.delete({ where: { id: existing.id } });
  return existing;
}

/* -------------------------------------------------------------------------- */
/*                          FIRM-TOP DEFAULT SPLIT                            */
/* -------------------------------------------------------------------------- */

/**
 * The firm-wide default split — the top of the cascade. Every cont and
 * category that has no more-specific rule inherits this live. There is at most
 * one row per client (clientId is unique). null = not configured, in which
 * case resolution falls through to the legacy default vertical at 100%.
 */
export async function getFirmDefaultSplits(
  prisma: PrismaClient,
  clientId: string
): Promise<AllocationSplit[] | null> {
  const row = await prisma.firmVerticalDefault.findUnique({
    where: { clientId },
  });
  if (!row) return null;
  const splits = parseSplits(row.splits);
  return splits.length > 0 ? splits : null;
}

export async function setFirmDefaultSplits(
  prisma: PrismaClient,
  clientId: string,
  splits: AllocationSplit[]
) {
  validateSplits(splits);

  const vIds = Array.from(new Set(splits.map((s) => s.verticalId)));
  const verticals = await prisma.vertical.findMany({
    where: { clientId, id: { in: vIds } },
    select: { id: true },
  });
  if (verticals.length !== vIds.length) {
    throw new Error("Una sau mai multe linii de business nu apartin acestei firme");
  }

  return prisma.firmVerticalDefault.upsert({
    where: { clientId },
    create: {
      clientId,
      splits: splits as unknown as Prisma.InputJsonValue,
    },
    update: {
      splits: splits as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function clearFirmDefaultSplits(
  prisma: PrismaClient,
  clientId: string
) {
  const existing = await prisma.firmVerticalDefault.findUnique({
    where: { clientId },
  });
  if (!existing) return null;
  await prisma.firmVerticalDefault.delete({ where: { clientId } });
  return existing;
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function parseSplits(value: unknown): AllocationSplit[] {
  if (!Array.isArray(value)) return [];
  const out: AllocationSplit[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const v = (item as Record<string, unknown>).verticalId;
    const p = (item as Record<string, unknown>).percent;
    if (typeof v === "string" && typeof p === "number") {
      out.push({ verticalId: v, percent: p });
    }
  }
  return out;
}

function validateSplits(splits: AllocationSplit[]): void {
  if (splits.length < 1) throw new Error("Trebuie sa selectezi cel putin o verticala");
  if (splits.length > MAX_SPLITS_PER_ALLOCATION) {
    throw new Error(`Maxim ${MAX_SPLITS_PER_ALLOCATION} verticale pe alocare`);
  }
  let total = 0;
  const seen = new Set<string>();
  for (const s of splits) {
    if (!s.verticalId) throw new Error("Verticala lipsa la o intrare");
    if (seen.has(s.verticalId)) {
      throw new Error("Aceeasi verticala apare de doua ori in alocare");
    }
    seen.add(s.verticalId);
    if (!Number.isInteger(s.percent) || s.percent < 1 || s.percent > 100) {
      throw new Error("Procentele trebuie numere intregi intre 1 si 100");
    }
    total += s.percent;
  }
  if (total !== 100) {
    throw new Error(`Procentele trebuie sa sumeze 100 (acum sumeaza ${total})`);
  }
}

/** Scale a set of partial percents back to a 100-sum, rounding to integers
 *  and adjusting the largest entry to absorb the rounding remainder. */
function renormalizeSplits(
  splits: AllocationSplit[],
  currentTotal: number
): AllocationSplit[] {
  if (currentTotal === 100) return splits;
  if (currentTotal <= 0) return splits;
  const scaled = splits.map((s) => ({
    verticalId: s.verticalId,
    percent: Math.round((s.percent / currentTotal) * 100),
  }));
  const newTotal = scaled.reduce((sum, s) => sum + s.percent, 0);
  if (newTotal !== 100) {
    // adjust the largest split to absorb the difference
    let maxIdx = 0;
    for (let i = 1; i < scaled.length; i++) {
      if (scaled[i].percent > scaled[maxIdx].percent) maxIdx = i;
    }
    scaled[maxIdx] = {
      verticalId: scaled[maxIdx].verticalId,
      percent: scaled[maxIdx].percent + (100 - newTotal),
    };
  }
  return scaled;
}

export { DEFAULT_VERTICAL_NAME };
