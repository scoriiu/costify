/**
 * Loader for the F20 form structure (OMFP 1802 Anexa 3).
 *
 * The structure lives in seeds/f20-structure.json and describes the rows of
 * the official CPP form exactly as filed. computeCppF20 consumes this to
 * render each row with the accounts that feed it.
 *
 * Pure, sync, cached after first load. Used by tests + compute layer.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type F20Section = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type F20RowKind = "detail" | "subtotal" | "total";

/** Side of the rulaj that contributes to this row. D = rulajTD, C = rulajTC. */
export type F20Side = "D" | "C";

export interface F20DetailRow {
  rowNumber: string;
  label: string;
  section: F20Section;
  indent: number;
  kind: "detail";
  /** Which side of the rulaj contributes. */
  side: F20Side;
  /** "-" means the row is subtracted from its parent subtotal/total. */
  sign?: "-";
  /** OMFP base codes that feed this row. Analytics match via contBase. */
  accounts: string[];
  /**
   * When true, the accounts list is intentionally incomplete pending
   * accountant confirmation. The row will render with value = 0 until
   * explicit account codes are added. See
   * docs/ro/intrebari-contabil-f20-detaliat.md for the open questions.
   */
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

export interface F20Structure {
  version: string;
  source: string;
  description: string;
  rows: F20Row[];
}

let cached: F20Structure | null = null;

export function loadF20Structure(): F20Structure {
  if (cached) return cached;
  const path = join(process.cwd(), "seeds", "f20-structure.json");
  const raw = readFileSync(path, "utf-8");
  cached = JSON.parse(raw) as F20Structure;
  return cached;
}

export function resetF20Cache(): void {
  cached = null;
}

export function isDetailRow(row: F20Row): row is F20DetailRow {
  return row.kind === "detail";
}

export function isComputedRow(row: F20Row): row is F20ComputedRow {
  return row.kind === "subtotal" || row.kind === "total";
}
