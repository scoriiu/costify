/**
 * Loader for the F20 form structure (currently OMF 2036/2025 Anexa 1).
 *
 * The structure lives in seeds/f20-structure.json and is the single source
 * of truth. To upgrade to a future OMF, replace the JSON — no code change
 * is needed if the schema is preserved.
 *
 * Schema contract (the JSON must provide ALL of these):
 *  - version, source, description, applicableFromYear (metadata)
 *  - rows[]                 — the document structure
 *  - dualRowAccounts[]      — accounts that split across two rows by sign
 *  - taxRegimeAccounts{}    — tax regime → which account / which row
 *  - summary{}              — named aggregate fields → rows that carry them
 *
 * Pure, sync, cached after first load. Used by tests + compute layer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export type F20Section = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type F20RowKind = "detail" | "subtotal" | "total" | "info";

/** Side of the rulaj that contributes to this row. D = rulajTD, C = rulajTC. */
export type F20Side = "D" | "C";

export interface F20DetailRow {
  rowNumber: string;
  label: string;
  section: F20Section;
  indent: number;
  /**
   * "detail" = standard summed-from-accounts row.
   * "info"   = sub-line for transparency only ("- din care: 7584"). Not summed
   *            into parent (parent already includes it via the main row).
   */
  kind: "detail" | "info";
  /** Which side of the rulaj contributes. Optional on info-only sub-rows. */
  side?: F20Side;
  /** "-" means the row is subtracted from its parent subtotal/total. */
  sign?: "-";
  /** OMFP base codes that feed this row. Analytics match via contBase. */
  accounts: string[];
  pendingAccountantReview?: boolean;
  note?: string;
  source?: string;
}

export interface F20ComputedRow {
  rowNumber: string;
  label: string;
  section: F20Section;
  indent: number;
  kind: "subtotal" | "total";
  /** Symbolic formula, e.g. "rd.01 + rd.07 - rd.08". Evaluated in computeCppF20. */
  formula: string;
  note?: string;
  source?: string;
}

export type F20Row = F20DetailRow | F20ComputedRow;

export interface F20DualRowAccounts {
  accounts: string[];
  positiveRow: string;
  negativeRow: string;
  note?: string;
}

export interface F20TaxRegimeMapping {
  account: string;
  row: string;
}

export interface F20SummaryField {
  /** Single source row (e.g. venituriTotale = rd. 74). */
  row?: string;
  /** Paired rows where the signed result is positiveRow − negativeRow. */
  positiveRow?: string;
  negativeRow?: string;
}

export interface F20Structure {
  version: string;
  source: string;
  description: string;
  applicableFromYear: number;
  dualRowAccounts: F20DualRowAccounts[];
  taxRegimeAccounts: Record<string, F20TaxRegimeMapping>;
  summary: Record<string, F20SummaryField>;
  rows: F20Row[];
}

// Zod schema that validates the JSON contract — fail-fast at boot time
// so a malformed OMF upgrade never silently produces wrong numbers.
const sectionSchema = z.enum(["A", "B", "C", "D", "E", "F", "G"]);
const sideSchema = z.enum(["D", "C"]);

const detailRowSchema = z.object({
  rowNumber: z.string(),
  label: z.string(),
  section: sectionSchema,
  indent: z.number(),
  kind: z.enum(["detail", "info"]),
  // info rows (sub-line "din care: ...") often have no side because they're
  // informational and not summed into a parent.
  side: sideSchema.optional(),
  sign: z.literal("-").optional(),
  accounts: z.array(z.string()).default([]),
  pendingAccountantReview: z.boolean().optional(),
  note: z.string().optional(),
  source: z.string().optional(),
});

const computedRowSchema = z.object({
  rowNumber: z.string(),
  label: z.string(),
  section: sectionSchema,
  indent: z.number(),
  kind: z.enum(["subtotal", "total"]),
  formula: z.string(),
  note: z.string().optional(),
  source: z.string().optional(),
});

const rowSchema = z.union([detailRowSchema, computedRowSchema]);

const structureSchema = z.object({
  version: z.string(),
  source: z.string(),
  description: z.string(),
  applicableFromYear: z.number(),
  dualRowAccounts: z.array(z.object({
    accounts: z.array(z.string()),
    positiveRow: z.string(),
    negativeRow: z.string(),
    note: z.string().optional(),
  })),
  taxRegimeAccounts: z.record(z.string(), z.object({
    account: z.string(),
    row: z.string(),
  })),
  summary: z.record(z.string(), z.object({
    row: z.string().optional(),
    positiveRow: z.string().optional(),
    negativeRow: z.string().optional(),
  })),
  rows: z.array(rowSchema),
});

let cached: F20Structure | null = null;

export function loadF20Structure(): F20Structure {
  if (cached) return cached;
  const path = join(process.cwd(), "seeds", "f20-structure.json");
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  const result = structureSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `F20 structure validation failed (${path}): ${result.error.message}`
    );
  }
  cached = result.data as F20Structure;
  return cached;
}

export function resetF20Cache(): void {
  cached = null;
}

export function isDetailRow(row: F20Row): row is F20DetailRow {
  return row.kind === "detail" || row.kind === "info";
}

export function isComputedRow(row: F20Row): row is F20ComputedRow {
  return row.kind === "subtotal" || row.kind === "total";
}
