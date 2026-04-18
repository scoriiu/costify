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
  ApRole,
  ArRole,
  CashRole,
  CatalogAccount,
  CppGroup,
  OmfpSeedFile,
  PayrollRole,
  VatRole,
} from "./types";
import { deriveFlags } from "./flags";

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

    const special = (a.special as AccountSpecial | undefined) ?? null;
    const derived = deriveFlags(a.code, special);

    map.set(a.code, {
      code: a.code,
      name: a.name,
      type: a.type as AccountType,
      classDigit,
      cppGroup: (a.cppGroup as CppGroup | undefined) ?? null,
      cppLabel: a.cppLabel ?? null,
      special,

      isClosing: a.isClosing ?? derived.isClosing,
      isProfitTax: a.isProfitTax ?? derived.isProfitTax,
      isProfitDistribution: a.isProfitDistribution ?? derived.isProfitDistribution,
      isExtraBilantier: a.isExtraBilantier ?? derived.isExtraBilantier,
      isIfrsOnly: a.isIfrsOnly ?? false,

      cashRole: (a.cashRole as CashRole | undefined) ?? derived.cashRole,
      arRole: (a.arRole as ArRole | undefined) ?? derived.arRole,
      apRole: (a.apRole as ApRole | undefined) ?? derived.apRole,
      vatRole: (a.vatRole as VatRole | undefined) ?? derived.vatRole,
      payrollRole: (a.payrollRole as PayrollRole | undefined) ?? derived.payrollRole,
    });
  }

  cached = map;
  return map;
}

export function resetSyncCache(): void {
  cached = null;
}
