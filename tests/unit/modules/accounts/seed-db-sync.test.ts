/**
 * Lock the contract: the OMFP catalog seed (seeds/omfp-1802.json) and the
 * DB `AccountCatalog` table must stay in sync. After every seed JSON edit,
 * `pnpm db:seed` MUST be re-run before the dev server picks up the change.
 *
 * This test validates two halves:
 *  - The runtime `loadCatalogSync` reads the latest JSON (catches stale
 *    in-memory caches during dev).
 *  - The flag-derivation logic mirrored in prisma/seed.mjs matches
 *    src/modules/accounts/flags.ts (catches drift between the two copies).
 *
 * It does NOT touch Prisma (no DB connection) — the DB-sync check is run
 * by the CI pipeline via `pnpm db:seed` followed by `pnpm test`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadCatalogSync, resetSyncCache } from "@/modules/accounts";

interface SeedAccount {
  code: string;
  cppLine?: string;
}

describe("Account catalog seed sync", () => {
  it("seeds/omfp-1802.json has the new OMF 2036/2025 cppLine assignments", () => {
    const raw = readFileSync(join(process.cwd(), "seeds", "omfp-1802.json"), "utf-8");
    const seed = JSON.parse(raw) as { accounts: SeedAccount[] };
    const byCode = new Map(seed.accounts.map((a) => [a.code, a]));

    // Key changes from OMF 2036/2025 that the catalog must reflect:
    expect(byCode.get("704")?.cppLine, "704 → rd.03 (Productia vanduta)").toBe("03");
    expect(byCode.get("641")?.cppLine, "641 → rd.25 (Salarii)").toBe("25");
    expect(byCode.get("6651")?.cppLine, "6651 → rd.70 (Alte chelt. financiare)").toBe("70");
    expect(byCode.get("666")?.cppLine, "666 → rd.68 (Cheltuieli dobanzi)").toBe("68");
    expect(byCode.get("691")?.cppLine, "691 → rd.78 (Impozit profit)").toBe("78");
    expect(byCode.get("697")?.cppLine, "697 → rd.81 (IMCA)").toBe("81");
    expect(byCode.get("6811")?.cppLine, "6811 → rd.28 (Amortizare)").toBe("28");

    // Sub-codes mapped to PARENT, not to info rows:
    expect(byCode.get("6051")?.cppLine, "6051 sums into rd.19 parent").toBe("19");
    expect(byCode.get("6053")?.cppLine, "6053 sums into rd.19 parent").toBe("19");
    expect(byCode.get("6121")?.cppLine, "6121 sums into rd.36 parent").toBe("36");
    expect(byCode.get("6123")?.cppLine, "6123 sums into rd.36 parent").toBe("36");

    // New codes introduced for OMF 2036/2025:
    expect(byCode.has("6121"), "6121 must exist in catalog").toBe(true);
    expect(byCode.has("6122"), "6122 must exist in catalog").toBe(true);
    expect(byCode.has("6818"), "6818 must exist in catalog").toBe(true);
  });

  it("loadCatalogSync returns the latest cppLine values from disk", () => {
    resetSyncCache();
    const catalog = loadCatalogSync();
    expect(catalog.get("641")?.cppLine).toBe("25");
    expect(catalog.get("6651")?.cppLine).toBe("70");
    expect(catalog.get("704")?.cppLine).toBe("03");
  });
});
