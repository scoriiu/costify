/**
 * Sync loader for the OMFP catalog from the seeds JSON file.
 * Used by pure functions (compute-cpp, tests) that cannot await DB.
 * Production code should use loadCatalog() from catalog-cache.ts which
 * reads from the database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  AccountSpecial,
  AccountType,
  CatalogAccount,
  CppGroup,
  OmfpSeedFile,
} from "./types";

let cached: Map<string, CatalogAccount> | null = null;

export function loadCatalogSync(): Map<string, CatalogAccount> {
  if (cached) return cached;

  const seedPath = join(process.cwd(), "seeds", "omfp-1802.json");
  const raw = readFileSync(seedPath, "utf-8");
  const data = JSON.parse(raw) as OmfpSeedFile;

  const map = new Map<string, CatalogAccount>();
  for (const a of data.accounts) {
    const classDigit = parseInt(a.code.charAt(0), 10);
    if (isNaN(classDigit)) continue;

    map.set(a.code, {
      code: a.code,
      name: a.name,
      type: a.type as AccountType,
      classDigit,
      cppGroup: (a.cppGroup as CppGroup | undefined) ?? null,
      cppLabel: a.cppLabel ?? null,
      special: (a.special as AccountSpecial | undefined) ?? null,
    });
  }

  cached = map;
  return map;
}

export function resetSyncCache(): void {
  cached = null;
}
