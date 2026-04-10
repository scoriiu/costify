import { prisma } from "@/lib/db";
import { getContBase } from "@/lib/accounts";
import { loadCatalog } from "./catalog-cache";
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
  const [clientAccounts, catalog] = await Promise.all([
    getClientAccounts(clientId),
    loadCatalog(),
  ]);
  return resolveFromMaps(cont, clientAccounts, catalog);
}

export function resolveFromMaps(
  cont: string,
  clientAccounts: Map<string, ClientAccountRecord>,
  catalog: Map<string, CatalogAccount>
): ResolvedAccountName {
  const clientExact = clientAccounts.get(cont);
  if (clientExact) {
    return {
      name: clientExact.customName,
      unmapped: false,
      source: clientExact.source === "user_edit" ? "client_edit" : "client_import",
    };
  }

  const catalogExact = catalog.get(cont);
  if (catalogExact) {
    return { name: catalogExact.name, unmapped: false, source: "omfp_catalog" };
  }

  const base = getContBase(cont);
  if (base !== cont) {
    const catalogBase = catalog.get(base);
    if (catalogBase) {
      return { name: catalogBase.name, unmapped: false, source: "omfp_catalog" };
    }
  }

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

export async function bulkUpsertFromImport(
  clientId: string,
  names: Map<string, string>
): Promise<{ created: number; updated: number; skipped: number }> {
  const existing = await prisma.clientAccount.findMany({
    where: { clientId, code: { in: [...names.keys()] } },
  });
  const existingMap = new Map(existing.map((e) => [e.code, e]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [code, name] of names.entries()) {
    if (!name || name.trim() === "") continue;
    const row = existingMap.get(code);

    if (!row) {
      await prisma.clientAccount.create({
        data: { clientId, code, customName: name, source: "saga_import" },
      });
      created++;
      continue;
    }

    if (row.source === "user_edit") {
      await prisma.clientAccount.update({
        where: { id: row.id },
        data: { lastSeenAt: new Date() },
      });
      skipped++;
      continue;
    }

    if (row.customName !== name) {
      await prisma.clientAccount.update({
        where: { id: row.id },
        data: { customName: name, lastSeenAt: new Date() },
      });
      updated++;
    } else {
      await prisma.clientAccount.update({
        where: { id: row.id },
        data: { lastSeenAt: new Date() },
      });
    }
  }

  return { created, updated, skipped };
}
