import { prisma } from "@/lib/db";
import type { AccountSpecial, AccountType, CatalogAccount, CppGroup } from "./types";

let cachePromise: Promise<Map<string, CatalogAccount>> | null = null;

export async function loadCatalog(): Promise<Map<string, CatalogAccount>> {
  if (!cachePromise) {
    cachePromise = fetchCatalog();
  }
  return cachePromise;
}

export function invalidateCatalog(): void {
  cachePromise = null;
}

async function fetchCatalog(): Promise<Map<string, CatalogAccount>> {
  const rows = await prisma.accountCatalog.findMany();
  const map = new Map<string, CatalogAccount>();
  for (const r of rows) {
    map.set(r.code, {
      code: r.code,
      name: r.name,
      type: r.type as AccountType,
      classDigit: r.classDigit,
      cppGroup: (r.cppGroup as CppGroup | null) ?? null,
      cppLabel: r.cppLabel ?? null,
      special: (r.special as AccountSpecial | null) ?? null,
    });
  }
  return map;
}
