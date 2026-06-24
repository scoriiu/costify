/**
 * Loads the per business-line (vertical) context the CPP breakdown needs,
 * resolved AS OF the selected month — the same builders the Mapari tab and
 * owner snapshot use, so the CPP split matches them line for line.
 *
 * Returns null when the client has no business lines enabled (the common
 * case), so callers pay nothing extra.
 */

import { prisma } from "@/lib/db";
import { periodKey } from "@/lib/period";
import {
  listVerticals,
  listAllocationVersions,
  listCategoryAllocationVersions,
  listFirmDefaultVersions,
  buildVerticalResolverAsOf,
} from "@/modules/verticals";
import {
  listCategoryTree,
  listMappingVersions,
  buildResolverStateAsOf,
} from "@/modules/categories";
import type { CppVerticalContext } from "./cpp-vertical";

export async function loadCppVerticalContext(
  clientId: string,
  year: number,
  month: number
): Promise<CppVerticalContext | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { verticalsEnabled: true },
  });
  if (!client?.verticalsEnabled) return null;

  const [verticals, allocVersions, catAllocVersions, firmVersions, treeResult, mappingVersions] =
    await Promise.all([
      listVerticals(prisma, clientId),
      listAllocationVersions(prisma, clientId),
      listCategoryAllocationVersions(prisma, clientId),
      listFirmDefaultVersions(prisma, clientId),
      listCategoryTree(prisma, clientId, { autoSeed: false }),
      listMappingVersions(prisma, clientId),
    ]);
  if (verticals.length === 0) return null;

  const period = periodKey(year, month);
  const defaultV = verticals.find((v) => v.isDefault);
  const resolver = buildVerticalResolverAsOf(
    allocVersions,
    defaultV?.id ?? null,
    catAllocVersions,
    firmVersions,
    period
  );
  const categoryResolver =
    mappingVersions.length > 0
      ? buildResolverStateAsOf(treeResult.tree, mappingVersions, period)
      : null;

  return {
    resolver,
    verticals: verticals.map((v) => ({ id: v.id, name: v.name, isDefault: v.isDefault })),
    categoryResolver,
  };
}
