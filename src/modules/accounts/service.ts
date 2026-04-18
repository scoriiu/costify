import { prisma } from "@/lib/db";
import { getContBase } from "@/lib/accounts";
import { loadCatalog } from "./catalog-cache";
import { decideImportUpsert, filterImportableNames } from "./import-upsert";
import type {
  CatalogAccount,
  ClientAccountRecord,
  ResolvedAccountName,
  AccountSource,
} from "./types";

export async function getCatalogAccount(code: string): Promise<CatalogAccount | null> {
  const catalog = await loadCatalog();
  return catalog.get(code) ?? null;
}

export async function getCatalogByBase(cont: string): Promise<CatalogAccount | null> {
  const catalog = await loadCatalog();
  const direct = catalog.get(cont);
  if (direct) return direct;

  const base = getContBase(cont);
  if (base === cont) return null;
  return catalog.get(base) ?? null;
}

export async function getCatalogMap(): Promise<Map<string, CatalogAccount>> {
  return loadCatalog();
}

/**
 * Returns a Map from analytic cont (e.g. "401.00023") to the extracted
 * partner name ("Orange Romania") stored in JournalPartner.
 *
 * These are the frequency-extracted names from explicatie during import —
 * distinct from ClientAccount.customName (which comes from Saga's denumire
 * columns or user edits). Partner names win for analytics per D10 + 3.4.
 */
export async function getPartnerNames(clientId: string): Promise<Map<string, string>> {
  const rows = await prisma.journalPartner.findMany({
    where: { clientId },
    select: { analyticAccount: true, partnerName: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.partnerName && r.partnerName.trim().length > 0) {
      map.set(r.analyticAccount, r.partnerName.trim());
    }
  }
  return map;
}

export async function getClientAccounts(clientId: string): Promise<Map<string, ClientAccountRecord>> {
  const rows = await prisma.clientAccount.findMany({
    where: { clientId },
  });
  const map = new Map<string, ClientAccountRecord>();
  for (const r of rows) {
    map.set(r.code, {
      code: r.code,
      customName: r.customName,
      source: r.source as AccountSource,
      partnerCode: r.partnerCode ?? null,
      needsReview: r.needsReview ?? false,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    });
  }
  return map;
}

export async function resolveAccountName(
  clientId: string,
  cont: string
): Promise<ResolvedAccountName> {
  const [clientAccounts, catalog, partnerNames] = await Promise.all([
    getClientAccounts(clientId),
    loadCatalog(),
    getPartnerNames(clientId),
  ]);
  return resolveFromMaps(cont, clientAccounts, catalog, partnerNames);
}

export function resolveFromMaps(
  cont: string,
  clientAccounts: Map<string, ClientAccountRecord>,
  catalog: Map<string, CatalogAccount>,
  partnerNames?: Map<string, string>
): ResolvedAccountName {
  const clientExact = clientAccounts.get(cont);

  // 1. Sticky user edit wins over everything
  if (clientExact?.source === "user_edit") {
    return {
      name: clientExact.customName,
      unmapped: false,
      source: "client_edit",
    };
  }

  // 2. For analytic accounts, prefer extracted partner name over catalog/saga base.
  //    A partner ("Orange Romania") is more informative than "Furnizori" even
  //    if Saga already set the customName to "Furnizori".
  const partnerName = partnerNames?.get(cont);
  if (partnerName) {
    return {
      name: partnerName,
      unmapped: false,
      source: "partner_extract",
    };
  }

  // 3. Client-imported name (Saga's `denumire_d`/`denumire_c` or similar)
  if (clientExact) {
    return {
      name: clientExact.customName,
      unmapped: false,
      source: "client_import",
    };
  }

  // 4. Direct catalog hit (the full code itself, no dot)
  const catalogExact = catalog.get(cont);
  if (catalogExact) {
    return { name: catalogExact.name, unmapped: false, source: "omfp_catalog" };
  }

  // 5. Catalog via contBase
  const base = getContBase(cont);
  if (base !== cont) {
    const catalogBase = catalog.get(base);
    if (catalogBase) {
      return { name: catalogBase.name, unmapped: false, source: "omfp_catalog" };
    }
  }

  // 6. Progressively shorter prefix (rare — for weird non-standard codes)
  for (let len = base.length - 1; len >= 2; len--) {
    const prefix = base.slice(0, len);
    const prefixMatch = catalog.get(prefix);
    if (prefixMatch) {
      return { name: prefixMatch.name, unmapped: false, source: "omfp_catalog" };
    }
  }

  return { name: `Cont ${cont}`, unmapped: true, source: "fallback" };
}

export async function upsertClientAccount(
  clientId: string,
  code: string,
  customName: string,
  source: AccountSource,
  partnerCode: string | null = null
): Promise<void> {
  const existing = await prisma.clientAccount.findUnique({
    where: { clientId_code: { clientId, code } },
  });

  if (!existing) {
    await prisma.clientAccount.create({
      data: { clientId, code, customName, source, partnerCode },
    });
    return;
  }

  if (existing.source === "user_edit" && source === "saga_import") {
    await prisma.clientAccount.update({
      where: { clientId_code: { clientId, code } },
      data: { lastSeenAt: new Date() },
    });
    return;
  }

  await prisma.clientAccount.update({
    where: { clientId_code: { clientId, code } },
    data: {
      customName,
      source,
      partnerCode: partnerCode ?? existing.partnerCode,
      lastSeenAt: new Date(),
    },
  });
}

export interface BulkUpsertResult {
  created: number;
  createdNeedingReview: number;
  updated: number;
  skipped: number;
}

export async function bulkUpsertFromImport(
  clientId: string,
  names: Map<string, string>
): Promise<BulkUpsertResult> {
  const filtered = filterImportableNames(names);
  if (filtered.size === 0) {
    return { created: 0, createdNeedingReview: 0, updated: 0, skipped: 0 };
  }

  const [existing, catalog] = await Promise.all([
    prisma.clientAccount.findMany({
      where: { clientId, code: { in: [...filtered.keys()] } },
    }),
    loadCatalog(),
  ]);
  const existingMap = new Map<string, ClientAccountRecord>();
  for (const r of existing) {
    existingMap.set(r.code, {
      code: r.code,
      customName: r.customName,
      source: r.source as AccountSource,
      partnerCode: r.partnerCode ?? null,
      needsReview: r.needsReview ?? false,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    });
  }

  let created = 0;
  let createdNeedingReview = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();

  for (const [code, name] of filtered.entries()) {
    const decision = decideImportUpsert(code, name, existingMap.get(code) ?? null, catalog);

    switch (decision.action) {
      case "create":
        await prisma.clientAccount.create({
          data: {
            clientId,
            code: decision.code,
            customName: decision.customName!,
            source: decision.source!,
            needsReview: decision.needsReview!,
          },
        });
        created++;
        if (decision.needsReview) createdNeedingReview++;
        break;

      case "update_name":
        await prisma.clientAccount.update({
          where: { clientId_code: { clientId, code: decision.code } },
          data: { customName: decision.customName!, lastSeenAt: now },
        });
        updated++;
        break;

      case "touch_last_seen":
        await prisma.clientAccount.update({
          where: { clientId_code: { clientId, code: decision.code } },
          data: { lastSeenAt: now },
        });
        break;

      case "skip_sticky_edit":
        await prisma.clientAccount.update({
          where: { clientId_code: { clientId, code: decision.code } },
          data: { lastSeenAt: now },
        });
        skipped++;
        break;
    }
  }

  return { created, createdNeedingReview, updated, skipped };
}
