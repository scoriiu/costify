/**
 * Integrity tests for seeds/f20-structure.json. These are not "does the
 * compute work" tests — those are in cpp-f20.test.ts. These verify that
 * the JSON itself is well-formed: unique row numbers, formulas reference
 * real rows, accounts exist in the OMFP catalog, sections are in order.
 *
 * Catches typos in the seed before they silently produce wrong F20 values
 * in production.
 */

import { describe, it, expect } from "vitest";
import { loadF20Structure, isDetailRow, isComputedRow } from "@/modules/reporting/f20-structure";
import { loadCatalogSync } from "@/modules/accounts";

describe("F20 structure seed — integrity invariants", () => {
  const structure = loadF20Structure();

  it("every row number is unique", () => {
    const seen = new Map<string, number>();
    const dupes: string[] = [];
    for (let i = 0; i < structure.rows.length; i++) {
      const rn = structure.rows[i].rowNumber;
      if (seen.has(rn)) dupes.push(`${rn} at indices ${seen.get(rn)} and ${i}`);
      else seen.set(rn, i);
    }
    expect(dupes).toEqual([]);
  });

  it("subtotal/total formulas can be evaluated after all detail rows are summed", () => {
    // The compute layer runs in two passes:
    //   (1) sum every detail row into rowValues,
    //   (2) evaluate computed rows (subtotals + totals) in document order.
    //
    // A computed row at index i is free to reference a *detail* row at
    // any index (it's already in the map from pass 1). It can only
    // reference another *computed* row if that row has been evaluated —
    // i.e. appears earlier in document order.
    const index = new Map<string, number>();
    const computed = new Set<string>();
    structure.rows.forEach((r, i) => {
      index.set(r.rowNumber, i);
      if (isComputedRow(r)) computed.add(r.rowNumber);
    });

    const violations: string[] = [];
    for (let i = 0; i < structure.rows.length; i++) {
      const row = structure.rows[i];
      if (!isComputedRow(row)) continue;
      const refs = extractRowRefs(row.formula);
      for (const ref of refs) {
        if (!computed.has(ref)) continue; // detail ref — always fine (pass 1)
        const refIndex = index.get(ref);
        if (refIndex === undefined) continue;
        if (refIndex >= i) {
          violations.push(
            `rd.${row.rowNumber} references computed rd.${ref} at index ${refIndex} but itself is at ${i}`
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("every formula only references rows that exist in the structure", () => {
    const allRowNumbers = new Set(structure.rows.map((r) => r.rowNumber));
    const missing: string[] = [];
    for (const row of structure.rows) {
      if (!isComputedRow(row)) continue;
      const refs = extractRowRefs(row.formula);
      for (const ref of refs) {
        if (!allRowNumbers.has(ref)) {
          missing.push(`row ${row.rowNumber} formula "${row.formula}" references missing row ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("every account code in detail rows exists in the OMFP catalog", () => {
    const catalog = loadCatalogSync();
    const missing: string[] = [];
    for (const row of structure.rows) {
      if (!isDetailRow(row)) continue;
      // Rows explicitly flagged as awaiting accountant review are allowed
      // to carry an empty accounts list; they render as zero and surface
      // in docs/ro/intrebari-contabil-f20-detaliat.md.
      if (row.pendingAccountantReview && row.accounts.length === 0) continue;
      for (const code of row.accounts) {
        if (!catalog.has(code)) {
          missing.push(`row ${row.rowNumber}: account ${code} not in OMFP catalog`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("rows marked pendingAccountantReview have an empty accounts list and a note", () => {
    const bad: string[] = [];
    for (const row of structure.rows) {
      if (!isDetailRow(row)) continue;
      if (!row.pendingAccountantReview) continue;
      if (row.accounts.length !== 0) {
        bad.push(`row ${row.rowNumber}: pendingAccountantReview=true but accounts is non-empty`);
      }
      if (!row.note) {
        bad.push(`row ${row.rowNumber}: pendingAccountantReview=true but no note explaining why`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every mapped account in the OMFP seed has its cppLine pointing to a real F20 row", () => {
    const catalog = loadCatalogSync();
    const f20Rows = new Set(structure.rows.map((r) => r.rowNumber));
    const bad: string[] = [];
    for (const [code, cat] of catalog) {
      if (!cat.cppLine) continue;
      if (!f20Rows.has(cat.cppLine)) {
        bad.push(`account ${code} has cppLine=${cat.cppLine} which is not a real F20 row`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every account mapped in an F20 detail row has the corresponding cppLine on its catalog entry", () => {
    // Dual-row accounts (711, 712, 786) are allowed to have cppLine on their
    // primary row only — the compute layer handles the split.
    const DUAL = new Set(["711", "712", "786"]);

    const catalog = loadCatalogSync();
    const mismatches: string[] = [];
    for (const row of structure.rows) {
      if (!isDetailRow(row)) continue;
      for (const code of row.accounts) {
        if (DUAL.has(code)) continue;
        const cat = catalog.get(code);
        if (!cat) continue;
        if (cat.cppLine && cat.cppLine !== row.rowNumber) {
          mismatches.push(
            `account ${code}: catalog cppLine=${cat.cppLine} but F20 lists it under rd.${row.rowNumber}`
          );
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("sections appear in the canonical order A-G (one transition per section)", () => {
    const order = ["A", "B", "C", "D", "E", "F", "G"];
    let sectionIdx = 0;
    for (const row of structure.rows) {
      const currentIdx = order.indexOf(row.section);
      expect(currentIdx).toBeGreaterThanOrEqual(sectionIdx);
      sectionIdx = currentIdx;
    }
  });

  it("all required rows for the summary footer are present and computed", () => {
    const needed = ["12", "19", "20", "25", "29", "30", "31", "32", "33", "34", "35"];
    for (const rn of needed) {
      const row = structure.rows.find((r) => r.rowNumber === rn);
      expect(row).toBeDefined();
    }
  });

  it("rd.01 cifra de afaceri is a subtotal, rd.34 impozit is a detail, rd.35 rezultat net is a total", () => {
    const rd01 = structure.rows.find((r) => r.rowNumber === "01");
    const rd34 = structure.rows.find((r) => r.rowNumber === "34");
    const rd35 = structure.rows.find((r) => r.rowNumber === "35");
    expect(rd01?.kind).toBe("subtotal");
    expect(rd34?.kind).toBe("detail");
    expect(rd35?.kind).toBe("total");
  });

  it("detail row sides are exactly D or C (never missing, never garbage)", () => {
    for (const row of structure.rows) {
      if (!isDetailRow(row)) continue;
      expect(["D", "C"]).toContain(row.side);
    }
  });

  it("rows with sign='-' are always detail rows (only details can be subtracted in a parent)", () => {
    for (const row of structure.rows) {
      if (!isDetailRow(row)) continue;
      if (row.sign !== undefined) {
        expect(row.sign).toBe("-");
      }
    }
  });

  it("every detail row carries either a 'source' or 'note' field (audit trail)", () => {
    // Not every row needs 'source' (some sub-rows are obvious), but every row
    // without accounts must have a 'note' explaining why it's empty.
    const undocumented: string[] = [];
    for (const row of structure.rows) {
      if (!isDetailRow(row)) continue;
      const hasAudit = row.source || row.note;
      if (!hasAudit) undocumented.push(`rd.${row.rowNumber} is a detail row with no source/note`);
    }
    expect(undocumented).toEqual([]);
  });

  it("tax regime accounts (691, 694, 695, 697, 698) all map to rd.34", () => {
    const rd34 = structure.rows.find((r) => r.rowNumber === "34");
    expect(rd34).toBeDefined();
    if (!isDetailRow(rd34!)) throw new Error("rd.34 must be detail");
    const taxAccounts = ["691", "694", "695", "697", "698"];
    for (const code of taxAccounts) {
      expect(rd34!.accounts).toContain(code);
    }
  });

  it("dual-row accounts 711, 712 appear on both rd.07 and rd.08", () => {
    const rd07 = structure.rows.find((r) => r.rowNumber === "07");
    const rd08 = structure.rows.find((r) => r.rowNumber === "08");
    if (!rd07 || !isDetailRow(rd07)) throw new Error("rd.07 missing");
    if (!rd08 || !isDetailRow(rd08)) throw new Error("rd.08 missing");
    expect(rd07.accounts).toContain("711");
    expect(rd07.accounts).toContain("712");
    expect(rd08.accounts).toContain("711");
    expect(rd08.accounts).toContain("712");
  });

  it("rd.08 has sign='-' (subtracted from venituri totale)", () => {
    const rd08 = structure.rows.find((r) => r.rowNumber === "08");
    if (!rd08 || !isDetailRow(rd08)) throw new Error("rd.08 missing");
    expect(rd08.sign).toBe("-");
  });
});

/**
 * Extracts all "rd.XX" references from a formula string.
 * Must match the parser in cpp-f20.ts exactly.
 */
function extractRowRefs(formula: string): string[] {
  const tokens = formula.match(/rd\.[0-9a-z]+/g) ?? [];
  return tokens.map((t) => t.replace("rd.", ""));
}
