/**
 * CostCategory + AccountCategoryMapping service.
 *
 * All functions take a clientId and a prisma client. The clientId scope is
 * enforced inside each query (defense-in-depth on top of the route-level
 * tenant guard).
 *
 * Mutations are audited by the actions layer, not here — the service stays
 * pure-ish (returns the data needed to build the audit record alongside the
 * result of the write).
 */

import type { PrismaClient } from "@prisma/client";
import type { CategoryKind, CostCategoryNode, MappingScope } from "./types";
import { seedOmfpDefaults, type SeedReport } from "./seed";
import { scopeToWindow, type MappingPeriodScope } from "@/lib/period";

/**
 * Returns the full category tree for a client, with mapping counts attached.
 * If `autoSeed` is true and the client has zero categories, the OMFP defaults
 * are seeded before reading.
 */
export async function listCategoryTree(
  prisma: PrismaClient,
  clientId: string,
  opts: { autoSeed?: boolean } = {}
): Promise<{ tree: CostCategoryNode[]; seeded: SeedReport | null }> {
  let seeded: SeedReport | null = null;

  if (opts.autoSeed) {
    const existing = await prisma.costCategory.count({ where: { clientId } });
    if (existing === 0) {
      seeded = await seedOmfpDefaults(prisma, clientId);
    }
  }

  const rows = await prisma.costCategory.findMany({
    where: { clientId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  const mappingCounts = await prisma.accountCategoryMapping.groupBy({
    by: ["categoryId"],
    where: { clientId, categoryId: { not: null }, effectiveTo: null },
    _count: { _all: true },
  });
  const countByCategoryId = new Map<string, number>();
  for (const row of mappingCounts) {
    if (row.categoryId !== null) {
      countByCategoryId.set(row.categoryId, row._count._all);
    }
  }

  const tree = buildTree(rows, countByCategoryId);
  return { tree, seeded };
}

interface RawCategoryRow {
  id: string;
  clientId: string;
  parentId: string | null;
  name: string;
  kind: string;
  position: number;
  isOmfpDefault: boolean;
}

function buildTree(
  rows: RawCategoryRow[],
  mappingCounts: Map<string, number>
): CostCategoryNode[] {
  const byId = new Map<string, CostCategoryNode>();
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      clientId: row.clientId,
      parentId: row.parentId,
      name: row.name,
      kind: row.kind as CategoryKind,
      position: row.position,
      isOmfpDefault: row.isOmfpDefault,
      children: [],
      mappingCount: mappingCounts.get(row.id) ?? 0,
    });
  }
  const roots: CostCategoryNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId === null) {
      roots.push(node);
    } else {
      const parent = byId.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan parent — surface at root so it stays visible
    }
  }
  return roots;
}

/** List the inception ("pentru toate perioadele") mappings for a client.
 *  This is the period-independent view: the resolver built from it behaves
 *  exactly as before period-scoping. Loaders that need per-month resolution
 *  use `listMappingVersions` instead. */
export async function listMappings(
  prisma: PrismaClient,
  clientId: string
): Promise<Array<{ cont: string; categoryId: string; scope: MappingScope }>> {
  const rows = await prisma.accountCategoryMapping.findMany({
    where: { clientId, effectiveFrom: 0, effectiveTo: null, categoryId: { not: null } },
    select: { cont: true, categoryId: true, scope: true },
  });
  return rows.map((r) => ({
    cont: r.cont,
    categoryId: r.categoryId as string,
    scope: r.scope as MappingScope,
  }));
}

/** All versions (inception + dated open + bounded overrides) for a client,
 *  for the as-of resolver (ADR-0004 D2). categoryId null = tombstone. */
export async function listMappingVersions(
  prisma: PrismaClient,
  clientId: string
): Promise<
  Array<{
    cont: string;
    categoryId: string | null;
    scope: MappingScope;
    effectiveFrom: number;
    effectiveTo: number | null;
  }>
> {
  const rows = await prisma.accountCategoryMapping.findMany({
    where: { clientId },
    select: {
      cont: true,
      categoryId: true,
      scope: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });
  return rows.map((r) => ({
    cont: r.cont,
    categoryId: r.categoryId,
    scope: r.scope as MappingScope,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
  }));
}

export interface CreateCategoryInput {
  clientId: string;
  parentId: string | null;
  name: string;
  kind: CategoryKind;
  /** If unset, appended at the end of its siblings. */
  position?: number;
}

export async function createCategory(
  prisma: PrismaClient,
  input: CreateCategoryInput
) {
  const trimmedName = input.name.trim();
  if (trimmedName.length === 0) {
    throw new Error("Numele liniei de cost nu poate fi gol");
  }
  if (trimmedName.length > 80) {
    throw new Error("Numele liniei de cost este prea lung (max 80 caractere)");
  }

  if (input.parentId) {
    const parent = await prisma.costCategory.findFirst({
      where: { id: input.parentId, clientId: input.clientId },
    });
    if (!parent) {
      throw new Error("Linia de cost parinte nu exista pentru aceasta firma");
    }
    if (parent.kind !== input.kind) {
      throw new Error("Sub-linia de cost trebuie sa aiba acelasi tip ca parintele");
    }
    // Max two levels: a subgroup cannot itself have subgroups.
    if (parent.parentId !== null) {
      throw new Error(
        "Un sub-grup nu poate avea sub-grupuri. Foloseste maximum doua niveluri."
      );
    }
  }

  const position =
    input.position ??
    (await prisma.costCategory.count({
      where: { clientId: input.clientId, parentId: input.parentId },
    }));

  return prisma.costCategory.create({
    data: {
      clientId: input.clientId,
      parentId: input.parentId,
      name: trimmedName,
      kind: input.kind,
      position,
      isOmfpDefault: false,
    },
  });
}

export async function renameCategory(
  prisma: PrismaClient,
  clientId: string,
  categoryId: string,
  newName: string
) {
  const trimmed = newName.trim();
  if (trimmed.length === 0) throw new Error("Numele liniei de cost nu poate fi gol");
  if (trimmed.length > 80) throw new Error("Numele este prea lung (max 80)");

  const existing = await prisma.costCategory.findFirst({
    where: { id: categoryId, clientId },
  });
  if (!existing) throw new Error("Linia de cost nu exista pentru aceasta firma");

  return prisma.costCategory.update({
    where: { id: categoryId },
    data: { name: trimmed },
  });
}

/**
 * Delete a category. Its mapped conturi are never silently orphaned:
 *   - Subgroup (has a parent): conturi move UP to the parent group.
 *   - Top-level group (no parent): conturi become "fara grupare" (unmapped),
 *     since there is no parent to receive them.
 * The destination is auto-decided here, so callers don't pass a strategy.
 */
export async function deleteCategory(
  prisma: PrismaClient,
  clientId: string,
  categoryId: string
) {
  const existing = await prisma.costCategory.findFirst({
    where: { id: categoryId, clientId },
    include: { _count: { select: { children: true, mappings: true } } },
  });
  if (!existing) throw new Error("Linia de cost nu exista pentru aceasta firma");

  if (existing._count.children > 0) {
    throw new Error(
      "Aceasta linie de cost are sub-linii. Sterge intai sub-liniile."
    );
  }

  await prisma.$transaction(async (tx) => {
    if (existing._count.mappings > 0) {
      if (existing.parentId) {
        await tx.accountCategoryMapping.updateMany({
          where: { clientId, categoryId },
          data: { categoryId: existing.parentId },
        });
      } else {
        await tx.accountCategoryMapping.deleteMany({
          where: { clientId, categoryId },
        });
      }
    }
    await tx.costCategory.delete({ where: { id: categoryId } });
  });

  return existing;
}

export interface MapAccountInput {
  clientId: string;
  cont: string;
  scope: MappingScope;
  categoryId: string;
  /** Period scope (ADR-0004 D3). Omitted = "pentru toate perioadele"
   *  (inception version), preserving the pre-period behavior. */
  periodScope?: MappingPeriodScope;
}

/**
 * Map one cont to a category. If a mapping already exists for this cont
 * (uniqueness on clientId+cont), it is updated in place — the caller can use
 * the same function for "create" and "move".
 */
export async function mapAccount(
  prisma: PrismaClient,
  input: MapAccountInput
) {
  const category = await prisma.costCategory.findFirst({
    where: { id: input.categoryId, clientId: input.clientId },
  });
  if (!category) {
    throw new Error("Linia de cost nu exista pentru aceasta firma");
  }

  const { effectiveFrom, effectiveTo } = scopeToWindow(input.periodScope);

  return prisma.accountCategoryMapping.upsert({
    where: {
      clientId_cont_effectiveFrom: {
        clientId: input.clientId,
        cont: input.cont,
        effectiveFrom,
      },
    },
    create: {
      clientId: input.clientId,
      cont: input.cont,
      scope: input.scope,
      categoryId: input.categoryId,
      effectiveFrom,
      effectiveTo,
    },
    update: {
      scope: input.scope,
      categoryId: input.categoryId,
      effectiveTo,
    },
  });
}

/**
 * Remove a cont's mapping. With no period scope this deletes the inception
 * version (today's "sterge maparea" for all periods). With a period scope it
 * writes a tombstone version (categoryId null) so the cont is explicitly
 * unmapped from that month onward, or only inside a window (ADR-0004 D3).
 */
export async function unmapAccount(
  prisma: PrismaClient,
  clientId: string,
  cont: string,
  periodScope?: MappingPeriodScope
) {
  if (!periodScope || periodScope.kind === "all") {
    const existing = await prisma.accountCategoryMapping.findFirst({
      where: { clientId, cont, effectiveFrom: 0 },
    });
    if (!existing) return null;
    await prisma.accountCategoryMapping.delete({ where: { id: existing.id } });
    return existing;
  }

  const { effectiveFrom, effectiveTo } = scopeToWindow(periodScope);
  return prisma.accountCategoryMapping.upsert({
    where: {
      clientId_cont_effectiveFrom: { clientId, cont, effectiveFrom },
    },
    create: {
      clientId,
      cont,
      scope: "contBase",
      categoryId: null,
      effectiveFrom,
      effectiveTo,
    },
    update: { categoryId: null, effectiveTo },
  });
}
