#!/usr/bin/env node
/**
 * Idempotent backfill: reads seeds/f20-structure.json and writes cppLine +
 * cppLineLabel onto every matching account in seeds/omfp-1802.json.
 *
 * Usage: node scripts/backfill-cpp-line.mjs
 *
 * Safe to run multiple times — values are replaced, not appended. Accounts
 * that F20 does not map (classes 1-5, class 8) are left untouched.
 *
 * For 711/712 and 786 (accounts that appear in two F20 rows), the positive
 * primary row wins at seed level. Compute layer (src/modules/reporting/
 * cpp-f20.ts) handles the split at runtime based on rulaj sign.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const F20_PATH = join(ROOT, "seeds", "f20-structure.json");
const OMFP_PATH = join(ROOT, "seeds", "omfp-1802.json");

// Primary row for accounts that appear on multiple F20 rows.
// The compute layer will reroute at runtime based on the sign of the rulaj.
const PRIMARY_OVERRIDE = {
  "711": "07",
  "712": "07",
  "786": "24",
};

function main() {
  const f20 = JSON.parse(readFileSync(F20_PATH, "utf-8"));
  const omfp = JSON.parse(readFileSync(OMFP_PATH, "utf-8"));

  // Build code -> {rowNumber, label} map, honoring the primary override.
  const codeToRow = new Map();
  for (const row of f20.rows) {
    if (row.kind !== "detail") continue;
    for (const code of row.accounts || []) {
      const override = PRIMARY_OVERRIDE[code];
      if (override && row.rowNumber !== override) continue;
      if (codeToRow.has(code)) continue; // first wins for plain codes
      codeToRow.set(code, { rowNumber: row.rowNumber, label: row.label });
    }
  }

  let updated = 0;
  let skipped = 0;
  for (const account of omfp.accounts) {
    const mapping = codeToRow.get(account.code);
    if (!mapping) {
      // If the account previously had a cppLine but F20 no longer maps it, clear it.
      if (account.cppLine !== undefined) {
        delete account.cppLine;
        delete account.cppLineLabel;
        updated++;
      }
      skipped++;
      continue;
    }
    const next = { line: mapping.rowNumber, label: mapping.label };
    if (account.cppLine === next.line && account.cppLineLabel === next.label) {
      continue;
    }
    account.cppLine = next.line;
    account.cppLineLabel = next.label;
    updated++;
  }

  // Rewrite the file, preserving 2-space indentation.
  writeFileSync(OMFP_PATH, JSON.stringify(omfp, null, 2) + "\n");
  console.log(`Backfilled cppLine: ${updated} accounts updated, ${skipped} without F20 mapping.`);
  console.log(`Mapped codes: ${codeToRow.size}`);
}

main();
