#!/usr/bin/env tsx
/**
 * Parse the official OMFP 1802/2014 consolidated HTML into a structured
 * chart of accounts.
 *
 * Source: docs/20260515/reglementarile-contabile-...html (2 MB, from lege5.ro)
 *
 * Strategy:
 *   1. Locate the chart-of-accounts section (between "Planul de conturi general este următorul"
 *      and "Transpunerea conturilor din balanţa de verificare").
 *   2. Strip all HTML tags from the section body and collapse whitespace.
 *   3. Walk line-by-line. Each account line matches one of:
 *        - "Clasa N - <name>"   → class header
 *        - "NN. <name>"         → group header (2-digit code, no type)
 *        - "NNN. <name>"        → 3-digit account (sintetic gr.1), may have (A), (P), or (A/P)
 *        - "NNNN. <name> (X)"   → 4-digit account (sintetic gr.2)
 *   4. The TYPE marker is the parenthesized letter at the end:
 *        (A)   → Activ
 *        (P)   → Pasiv
 *        (A/P) → Bifuncțional (B in our schema)
 *        (none) → header / group — not stored as an account
 *
 * Output: temp/omfp-1802-parsed.json — a structured representation we can
 * diff against our current seed.
 *
 * No mutations to seeds/. This is observe-only. Step 5 will diff + apply.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const HTML_PATH = join(
  ROOT,
  "docs",
  "20260515",
  "reglementarile-contabile-privind-situatiile-financiare-anuale-individuale-si-situatiile-financiare-anuale-consolidate-din-29122014.html"
);
const OUTPUT = join(ROOT, "temp", "omfp-1802-parsed.json");

const START_MARKER = "Planul de conturi general este următorul";
const END_MARKER = "Transpunerea conturilor din balanţa de verificare";

interface OmfpAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
  classDigit: number;
  groupCode: string; // 2-digit group (e.g. "10" for 101, 1011, 1012)
  /** Footnote markers like "<SUP>5</SUP>" on the original — kept for inspection. */
  hasFootnote: boolean;
  /** Class header text (e.g. "Conturi de capitaluri, provizioane, ..."). */
  className: string;
}

interface OmfpGroup {
  code: string;
  name: string;
  classDigit: number;
}

interface OmfpClass {
  digit: number;
  name: string;
}

interface ParsedChart {
  source: string;
  generatedAt: string;
  classes: OmfpClass[];
  groups: OmfpGroup[];
  accounts: OmfpAccount[];
  /** Lines that look like account rows but did not match the expected format —
   *  useful to inspect manually for edge cases (e.g. footnote-only rows). */
  unmatched: string[];
}

/**
 * Remove all HTML tags and decode the common entities, leaving plain text.
 * The lege5.ro export uses <span>, <p>, <SUP>, <a>; we drop them all.
 * Footnote markers like <SUP>5</SUP> are tracked separately before removal.
 */
function stripHtml(html: string): { text: string; footnotes: Set<number> } {
  const footnotes = new Set<number>();
  // Capture footnote numbers before stripping
  const supMatches = html.match(/<SUP>(\d+)<\/SUP>/g);
  if (supMatches) {
    for (const m of supMatches) {
      const n = m.match(/\d+/);
      if (n) footnotes.add(parseInt(n[0], 10));
    }
  }

  let text = html
    .replace(/<SUP>\d+<\/SUP>/g, " [FN] ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Romanian-specific entities and common diacritics
    .replace(/&[a-z]+;/g, " ");

  // Collapse runs of whitespace but preserve line breaks
  text = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");

  return { text, footnotes };
}

/**
 * Romanian diacritics are preserved by lege5 as named entities elsewhere in
 * the doc, but in this section they come through as UTF-8. We keep them in
 * `name` strings and strip them only when comparing to our seed (which uses
 * ASCII per Claudia 1.5).
 */
function normalizeAscii(s: string): string {
  return s
    .replace(/[ăâ]/gi, (m) => (m === m.toUpperCase() ? "A" : "a"))
    .replace(/[î]/gi, (m) => (m === m.toUpperCase() ? "I" : "i"))
    .replace(/[ș]/gi, (m) => (m === m.toUpperCase() ? "S" : "s"))
    .replace(/[ț]/gi, (m) => (m === m.toUpperCase() ? "T" : "t"))
    .replace(/[șş]/gi, (m) => (m === m.toUpperCase() ? "S" : "s"))
    .replace(/[țţ]/gi, (m) => (m === m.toUpperCase() ? "T" : "t"));
}

function parseChart(text: string): ParsedChart {
  const classes: OmfpClass[] = [];
  const groups: OmfpGroup[] = [];
  const accounts: OmfpAccount[] = [];
  const unmatched: string[] = [];

  let currentClass: OmfpClass | null = null;
  let currentGroup: OmfpGroup | null = null;

  const lines = text.split("\n");

  // Patterns:
  //   Class: "Clasa 1 - Conturi de capitaluri, ..."
  //   Group: "10. Capital şi rezerve" (1-2 digits)
  //   Account: "101. Capital", "1011. Capital subscris nevărsat (P)", etc.
  const classRe = /^Clasa\s+(\d)\s*-\s*(.+)$/;
  const groupRe = /^(\d{1,2})\.\s+(.+)$/;
  // 3-4 digit account, optionally followed by " [FN] " (footnote marker), then optional type
  const accountRe = /^(\d{3,4})\.\s+(.+?)(?:\s*\[FN\]\s*)?(?:\s*\(([AP](?:\/[AP])?)\))?\s*$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    // Class header
    const cm = classRe.exec(line);
    if (cm) {
      currentClass = { digit: parseInt(cm[1], 10), name: cm[2].trim() };
      classes.push(currentClass);
      currentGroup = null;
      continue;
    }

    // Try as account first (3-4 digit codes)
    const am = accountRe.exec(line);
    if (am) {
      const code = am[1];
      const nameRaw = am[2].trim().replace(/\s*\[FN\]\s*/g, "").trim();
      const typeStr = am[3];

      // Account codes must be 3+ digits. 2-digit codes are GROUP headers,
      // handled below. (The regex matches 3-4; we re-check.)
      if (code.length >= 3) {
        if (!currentClass) {
          unmatched.push(`No current class for: ${line}`);
          continue;
        }

        // Determine type. Classes 6 and 7 omit the type marker in the OMFP
        // text because cheltuieli are always A and venituri always P (with
        // documented exceptions we already handle in the seed: 711 variation
        // stocks is B). Class 8 is off-balance, treated as B + extraBilantier.
        // Class 9 is optional management accounts, typically A.
        let type: "A" | "P" | "B";
        if (typeStr) {
          type = typeStr === "A/P" ? "B" : (typeStr as "A" | "P");
        } else {
          // No type marker. Infer from class.
          switch (currentClass.digit) {
            case 6: type = "A"; break;
            case 7: type = "P"; break;
            case 8: type = "B"; break; // off-balance, bifunctional per Saga
            case 9: type = "A"; break;
            default:
              // Classes 1-5 must have an explicit type. Without one, it's a
              // synthetic gr.1 header (e.g. "101. Capital" with sub-accounts
              // 1011, 1012) — skip it as a group, not an account.
              groups.push({
                code,
                name: nameRaw,
                classDigit: currentClass.digit,
              });
              continue;
          }
        }

        const groupCode = code.slice(0, 2);
        accounts.push({
          code,
          name: nameRaw,
          type,
          classDigit: currentClass.digit,
          groupCode,
          hasFootnote: raw.includes("[FN]"),
          className: currentClass.name,
        });
        continue;
      }
    }

    // Group header (2-digit code)
    const gm = groupRe.exec(line);
    if (gm && gm[1].length <= 2) {
      const code = gm[1];
      if (!currentClass) {
        unmatched.push(`No current class for group: ${line}`);
        continue;
      }
      currentGroup = {
        code,
        name: gm[2].trim(),
        classDigit: currentClass.digit,
      };
      groups.push(currentGroup);
      continue;
    }

    // Anything else — footnote text, "(2)" subitems, etc. — skip silently if
    // short, store for inspection if long enough to be interesting.
    if (line.length > 30 && !line.startsWith("(") && /^\d/.test(line)) {
      unmatched.push(line);
    }
  }

  return {
    source: "OMFP 1802/2014 (consolidated from lege5.ro)",
    generatedAt: new Date().toISOString(),
    classes,
    groups,
    accounts,
    unmatched,
  };
}

function main() {
  console.log("Loading", HTML_PATH);
  const html = readFileSync(HTML_PATH, "utf-8");
  console.log(`File size: ${(html.length / 1024).toFixed(0)} KB`);

  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx < 0 || endIdx < 0) {
    console.error("Could not locate plan-de-conturi markers in HTML");
    console.error(`  start "${START_MARKER}": ${startIdx}`);
    console.error(`  end   "${END_MARKER}": ${endIdx}`);
    process.exit(1);
  }
  const section = html.slice(startIdx, endIdx);
  console.log(`Chart-of-accounts section: ${(section.length / 1024).toFixed(0)} KB`);

  const { text, footnotes } = stripHtml(section);
  console.log(`Plain text: ${text.split("\n").length} non-empty lines`);
  console.log(`Footnote markers seen: ${footnotes.size}`);

  const parsed = parseChart(text);

  console.log("");
  console.log("=== Parse summary ===");
  console.log(`Classes: ${parsed.classes.length}`);
  console.log(`Groups:  ${parsed.groups.length}`);
  console.log(`Accounts: ${parsed.accounts.length}`);
  console.log(`Unmatched lines: ${parsed.unmatched.length}`);

  // Type distribution
  const byType = { A: 0, P: 0, B: 0 };
  for (const a of parsed.accounts) byType[a.type]++;
  console.log(`  by type: A=${byType.A}, P=${byType.P}, B=${byType.B}`);

  // Code length distribution
  const byLen: Record<number, number> = {};
  for (const a of parsed.accounts) {
    byLen[a.code.length] = (byLen[a.code.length] ?? 0) + 1;
  }
  console.log(`  by code length:`, byLen);

  // Class distribution
  const byClass: Record<number, number> = {};
  for (const a of parsed.accounts) {
    byClass[a.classDigit] = (byClass[a.classDigit] ?? 0) + 1;
  }
  console.log(`  by class:`, byClass);

  // Sample
  console.log("");
  console.log("First 10 accounts:");
  for (const a of parsed.accounts.slice(0, 10)) {
    console.log(`  ${a.code} (${a.type}) ${a.name}${a.hasFootnote ? " [FN]" : ""}`);
  }
  console.log("");
  console.log("Last 5 accounts:");
  for (const a of parsed.accounts.slice(-5)) {
    console.log(`  ${a.code} (${a.type}) ${a.name}`);
  }

  if (parsed.unmatched.length > 0) {
    console.log("");
    console.log(`Unmatched (first 5):`);
    for (const u of parsed.unmatched.slice(0, 5)) console.log(`  ${u}`);
  }

  writeFileSync(OUTPUT, JSON.stringify(parsed, null, 2));
  console.log("");
  console.log(`Wrote ${OUTPUT}`);
  console.log(`Size: ${(JSON.stringify(parsed).length / 1024).toFixed(1)} KB`);
}

main();
