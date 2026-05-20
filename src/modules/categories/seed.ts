/**
 * Auto-seeding of the OMFP default taxonomy for a client (Axa A only).
 *
 * This file is the single source of truth for the default "natura cheltuielii"
 * taxonomy applied to every new client. It is intentionally kept in code (not
 * DB) so:
 *   - schema changes ship via PR review, not via runtime mutation,
 *   - every environment (dev / staging / prod) has the same starting point,
 *   - rollback is `git revert`, not a data migration.
 *
 * If the labels here change, NEW clients get the new labels. EXISTING clients
 * keep whatever they had — their tree was cloned at first visit and is now
 * their own (accountant may have renamed or restructured it). That is the
 * desired property: the system template can evolve without disrupting active
 * tenants.
 *
 * On first visit to the "Mapari Cashflow" tab (or first owner-snapshot
 * request that needs categories), we materialize a flat tree of one root per
 * 2-digit expense/revenue class, using the patron-friendly labels we pinned
 * in PR-2a.
 *
 * Each seeded node:
 *   - is marked isOmfpDefault=true so the UI can show a small badge,
 *   - gets a single AccountCategoryMapping with scope="contBase" mapping its
 *     2-digit code (e.g. "60") to itself,
 *   - lives directly under root (no L2/L3 by default). The accountant can
 *     restructure the tree freely; the resolver walks the tree, not the
 *     literal seed shape.
 *
 * Re-running this function on a client that already has any non-default
 * categories or non-default mappings is safe: we never delete, never rename,
 * never reassign — we only fill gaps. Idempotent by design.
 *
 * NOTE: This module owns Axa A (natura cheltuielii) only. The firm-specific
 * Axa B (verticale: Outsourcing, Recruitment, Coworking, etc.) is handled by
 * a separate Vertical module in PR-2c and never appears here.
 */

import type { PrismaClient } from "@prisma/client";

interface SeedDef {
  /** 2-digit account class (e.g. "60", "70"). */
  code: string;
  /** Patron-friendly label, identical to PR-2a copy. */
  label: string;
}

const EXPENSE_SEEDS: SeedDef[] = [
  { code: "60", label: "Marfa, materii prime si materiale" },
  { code: "61", label: "Energie, apa, intretinere" },
  { code: "62", label: "Servicii externe (chirie, IT, contabilitate)" },
  { code: "63", label: "Taxe si impozite (altele decat profit)" },
  { code: "64", label: "Salarii si contributii" },
  { code: "65", label: "Comisioane bancare si diferente curs" },
  { code: "66", label: "Dobanzi si cheltuieli financiare" },
  { code: "67", label: "Cheltuieli exceptionale" },
  { code: "68", label: "Amortizare si provizioane" },
  { code: "69", label: "Impozit pe profit" },
];

const REVENUE_SEEDS: SeedDef[] = [
  { code: "70", label: "Vanzari (cifra de afaceri)" },
  { code: "74", label: "Subventii din exploatare" },
  { code: "75", label: "Alte venituri din exploatare" },
  { code: "76", label: "Venituri financiare" },
  { code: "77", label: "Venituri exceptionale" },
  { code: "78", label: "Reluari de amortizari si provizioane" },
];

export interface SeedReport {
  categoriesCreated: number;
  mappingsCreated: number;
}

export async function seedOmfpDefaults(
  prisma: PrismaClient,
  clientId: string
): Promise<SeedReport> {
  let categoriesCreated = 0;
  let mappingsCreated = 0;

  // We seed in two passes (expense + revenue), each pass independent.
  for (const { kind, seeds } of [
    { kind: "expense" as const, seeds: EXPENSE_SEEDS },
    { kind: "revenue" as const, seeds: REVENUE_SEEDS },
  ]) {
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const result = await seedOne(prisma, clientId, kind, seed, i);
      if (result.categoryCreated) categoriesCreated++;
      if (result.mappingCreated) mappingsCreated++;
    }
  }

  return { categoriesCreated, mappingsCreated };
}

async function seedOne(
  prisma: PrismaClient,
  clientId: string,
  kind: "expense" | "revenue",
  seed: SeedDef,
  position: number
): Promise<{ categoryCreated: boolean; mappingCreated: boolean }> {
  let categoryCreated = false;
  let mappingCreated = false;

  // Idempotent: only create the root category if no node with this exact
  // (clientId, parentId=null, name) tuple exists. The accountant might have
  // renamed our seed last week — in that case we do nothing.
  const existing = await prisma.costCategory.findFirst({
    where: { clientId, parentId: null, name: seed.label },
  });

  let categoryId = existing?.id;
  if (!existing) {
    const created = await prisma.costCategory.create({
      data: {
        clientId,
        parentId: null,
        name: seed.label,
        kind,
        position,
        isOmfpDefault: true,
      },
    });
    categoryId = created.id;
    categoryCreated = true;
  }

  // Idempotent: only insert the mapping if the cont isn't already mapped
  // somewhere (a contabil-set mapping wins over the seed).
  const existingMapping = await prisma.accountCategoryMapping.findFirst({
    where: { clientId, cont: seed.code },
  });
  if (!existingMapping && categoryId) {
    await prisma.accountCategoryMapping.create({
      data: {
        clientId,
        scope: "contBase",
        cont: seed.code,
        categoryId,
      },
    });
    mappingCreated = true;
  }

  return { categoryCreated, mappingCreated };
}

export { EXPENSE_SEEDS, REVENUE_SEEDS };
