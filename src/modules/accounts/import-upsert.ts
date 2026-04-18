/**
 * Pure logic for deciding what to do with each imported analytic account.
 *
 * Given the current DB state (existing ClientAccount row, if any) and the
 * newly-seen name from the import, returns the action to take + the fields
 * to write. No I/O — deterministic and unit-testable.
 *
 * D14 rules:
 *  - If no existing row → create with source="saga_import". Set needsReview=true
 *    if contBase is not in AccountCatalog.
 *  - If existing row with source="user_edit" → touch lastSeenAt only (sticky edit).
 *  - If existing row with any other source → update customName if changed, touch lastSeenAt.
 *  - needsReview stays as-is on existing rows (don't override a manual review decision).
 */

import { getContBase } from "@/lib/accounts";
import type { CatalogAccount, ClientAccountRecord } from "./types";

export interface ImportUpsertDecision {
  action: "create" | "update_name" | "touch_last_seen" | "skip_sticky_edit";
  code: string;
  customName: string | null;
  source: "saga_import" | null;
  needsReview: boolean | null;
}

export function decideImportUpsert(
  code: string,
  importedName: string,
  existing: ClientAccountRecord | null,
  catalog: Map<string, CatalogAccount>
): ImportUpsertDecision {
  const trimmedName = importedName.trim();

  if (!existing) {
    // New analytic account — check catalog membership
    const base = getContBase(code);
    const inCatalog = catalog.has(base) || catalog.has(code);

    return {
      action: "create",
      code,
      customName: trimmedName,
      source: "saga_import",
      needsReview: !inCatalog,
    };
  }

  // Sticky user edit: never overwrite name
  if (existing.source === "user_edit") {
    return {
      action: "skip_sticky_edit",
      code,
      customName: null,
      source: null,
      needsReview: null,
    };
  }

  // Name changed — update it
  if (existing.customName !== trimmedName) {
    return {
      action: "update_name",
      code,
      customName: trimmedName,
      source: null, // keep existing source
      needsReview: null, // keep existing review flag
    };
  }

  // No change — just touch lastSeenAt
  return {
    action: "touch_last_seen",
    code,
    customName: null,
    source: null,
    needsReview: null,
  };
}

/**
 * Filters out empty names — we don't create accounts with empty customName.
 * This matches current behavior; name resolution fallback happens at read time.
 */
export function filterImportableNames(
  names: Map<string, string>
): Map<string, string> {
  const filtered = new Map<string, string>();
  for (const [code, name] of names) {
    if (name && name.trim().length > 0) filtered.set(code, name.trim());
  }
  return filtered;
}
