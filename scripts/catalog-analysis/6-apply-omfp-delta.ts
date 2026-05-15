#!/usr/bin/env tsx
/**
 * Apply the OMFP-vs-seed delta to seeds/omfp-1802.json.
 *
 * Three types of changes, each safe:
 *
 *   ADDS — accounts in OMFP 1802 official text but not in our seed.
 *     We add them with the OMFP name (stripped of diacritics per Claudia 1.5)
 *     and the parser-inferred type. They get no cppLine/role/flag — only
 *     code/name/type/classDigit. Those are set by hand later or by Costi.
 *
 *   NAME UPDATES — accounts in both, but OMFP name differs substantially.
 *     We update the seed name to the OMFP version (stripped of diacritics).
 *     Skip cases where we know Saga/seed is more practical (e.g. shorter,
 *     more useful for accountants).
 *
 *   SWAP FIXES — confirmed via OMFP HTML, accounts that had their names
 *     accidentally swapped in our seed:
 *       8032 ↔ 8033 (custodie vs prelucrare)
 *       8038 ↔ 8039 (bunuri primite vs alte valori)
 *       223 ↔ 224 (instalatii vs mobilier in curs)
 *
 * Things we deliberately DO NOT change:
 *
 *   Type diffs — Saga + practice trumps OMFP HTML for:
 *     609 (P), 709 (A), 711 (B), 5121/5124 (B). These are intentional.
 *
 *   Seed extensions — 70 accounts only in our seed (999, 6422, 6461, ...)
 *     stay. They're Saga-supported and used by real clients.
 *
 *   cppLine/roles/flags — preserved on existing accounts; new accounts have
 *     null. Hand-curated metadata is sacred.
 *
 * Usage:
 *   pnpm tsx scripts/catalog-analysis/6-apply-omfp-delta.ts          # dry
 *   pnpm tsx scripts/catalog-analysis/6-apply-omfp-delta.ts --apply  # write
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OMFP_PATH = join(ROOT, "temp", "omfp-1802-parsed.json");
const SEED_PATH = join(ROOT, "seeds", "omfp-1802.json");
const SUMMARY_PATH = join(ROOT, "temp", "omfp-apply-summary.md");

const APPLY = process.argv.includes("--apply");

interface OmfpAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
  classDigit: number;
}

interface SeedAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
  classDigit?: number;
  cppGroup?: string | null;
  cppLabel?: string | null;
  cppLine?: string | null;
  cppLineLabel?: string | null;
  special?: string | null;
  isClosing?: boolean;
  isProfitTax?: boolean;
  isProfitDistribution?: boolean;
  isExtraBilantier?: boolean;
  isIfrsOnly?: boolean;
  cashRole?: string | null;
  arRole?: string | null;
  apRole?: string | null;
  vatRole?: string | null;
  payrollRole?: string | null;
}

/** Strip Romanian diacritics from a name (Claudia 1.5 convention). */
function toAscii(s: string): string {
  return s
    .replace(/[ăâ]/g, "a")
    .replace(/[Ă]/g, "A")
    .replace(/[Â]/g, "A")
    .replace(/[î]/g, "i")
    .replace(/[Î]/g, "I")
    .replace(/[șş]/g, "s")
    .replace(/[ȘŞ]/g, "S")
    .replace(/[țţ]/g, "t")
    .replace(/[ȚŢ]/g, "T");
}

/**
 * Codes where we keep our seed name and IGNORE OMFP name diff because
 * our version is shorter / more practical and matches Saga.
 *
 * Format: code -> reason (logged in summary).
 */
const NAME_DIFFS_TO_SKIP: Map<string, string> = new Map([
  // Saga + our seed have shortened forms that are clearer for users
  ["701", "Saga: 'VEN. DIN VANZAREA PROD. FINITE'; we keep simpler name"],
  ["7642", "Our 'investitiile financiare pe termen scurt' is clearer than OMFP's 'investitii pe termen scurt'"],

  // Bank account type discrepancies are settled (Saga = B, OMFP HTML = A)
  // — these aren't name diffs but worth noting we keep our names

  // Our cppLine-aware names that explain context are kept
  ["6651", "Our 'Diferente nefavorabile de curs valutar' is the common name; OMFP has long-form"],
  ["7651", "Counterpart of 6651"],
]);

/**
 * Explicit name swap fixes. Our seed accidentally had these inverted.
 * OMFP HTML is authoritative.
 */
const NAME_SWAPS: Array<{ codeA: string; codeB: string; rationale: string }> = [
  {
    codeA: "8032",
    codeB: "8033",
    rationale:
      "OMFP: 8032 = primite spre prelucrare sau reparare; 8033 = primite in pastrare sau custodie. Our seed had them inverted.",
  },
  {
    codeA: "8038",
    codeB: "8039",
    rationale:
      "OMFP: 8038 = Bunuri primite in administrare/concesiune; 8039 = Alte valori in afara bilantului. Our seed had 'Credite restante' on 8039 — wrong code entirely.",
  },
  {
    codeA: "223",
    codeB: "224",
    rationale:
      "OMFP: 223 = Instalatii tehnice/mijloace transport in curs de aprovizionare; 224 = Mobilier/aparatura birotica in curs de aprovizionare. Our seed had them mis-labeled.",
  },
];

interface AddRecord {
  code: string;
  name: string;
  type: string;
  classDigit: number;
}
interface RenameRecord {
  code: string;
  before: string;
  after: string;
  similarity: string;
}
interface SwapRecord {
  codeA: string;
  codeB: string;
  beforeA: string;
  afterA: string;
  beforeB: string;
  afterB: string;
}

function main() {
  const omfp = JSON.parse(readFileSync(OMFP_PATH, "utf-8")) as {
    accounts: OmfpAccount[];
  };
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as {
    version: string;
    source: string;
    description: string;
    accounts: SeedAccount[];
  };

  const seedByCode = new Map(seed.accounts.map((a) => [a.code, a]));

  const adds: AddRecord[] = [];
  const renames: RenameRecord[] = [];
  const swaps: SwapRecord[] = [];
  const skippedRenames: Array<{ code: string; reason: string }> = [];
  const skippedTypeDiffs: Array<{ code: string; seedType: string; omfpType: string; reason: string }> = [];

  // 1. Apply name swaps first
  for (const swap of NAME_SWAPS) {
    const a = seedByCode.get(swap.codeA);
    const b = seedByCode.get(swap.codeB);
    if (!a || !b) {
      console.warn(`Swap skipped — code(s) not found: ${swap.codeA} or ${swap.codeB}`);
      continue;
    }
    // Look up authoritative names from OMFP
    const omfpA = omfp.accounts.find((x) => x.code === swap.codeA);
    const omfpB = omfp.accounts.find((x) => x.code === swap.codeB);
    if (!omfpA || !omfpB) {
      console.warn(`Swap skipped — OMFP missing one side: ${swap.codeA} or ${swap.codeB}`);
      continue;
    }

    const before = { a: a.name, b: b.name };
    a.name = toAscii(omfpA.name);
    b.name = toAscii(omfpB.name);
    swaps.push({
      codeA: swap.codeA,
      codeB: swap.codeB,
      beforeA: before.a,
      afterA: a.name,
      beforeB: before.b,
      afterB: b.name,
    });
  }

  // 2. Apply adds (OMFP accounts missing from our seed)
  for (const a of omfp.accounts) {
    if (seedByCode.has(a.code)) continue;
    const newAccount: SeedAccount = {
      code: a.code,
      name: toAscii(a.name),
      type: a.type,
      classDigit: a.classDigit,
    };
    seed.accounts.push(newAccount);
    seedByCode.set(a.code, newAccount);
    adds.push({
      code: a.code,
      name: newAccount.name,
      type: a.type,
      classDigit: a.classDigit,
    });
  }

  // 3. Apply name updates (substantive diffs, excluding skipped ones and swapped ones)
  const swappedCodes = new Set<string>();
  for (const s of NAME_SWAPS) {
    swappedCodes.add(s.codeA);
    swappedCodes.add(s.codeB);
  }
  for (const a of omfp.accounts) {
    if (swappedCodes.has(a.code)) continue;
    if (NAME_DIFFS_TO_SKIP.has(a.code)) {
      const reason = NAME_DIFFS_TO_SKIP.get(a.code)!;
      const seedA = seedByCode.get(a.code);
      if (seedA && normalize(seedA.name) !== normalize(toAscii(a.name))) {
        skippedRenames.push({ code: a.code, reason });
      }
      continue;
    }
    const seedA = seedByCode.get(a.code);
    if (!seedA) continue;
    const seedNorm = normalize(seedA.name);
    const omfpAscii = toAscii(a.name);
    const omfpNorm = normalize(omfpAscii);
    if (seedNorm === omfpNorm) continue;

    // Token overlap to decide if substantive
    const sTok = new Set(seedNorm.split(" ").filter((w) => w.length > 3));
    const oTok = new Set(omfpNorm.split(" ").filter((w) => w.length > 3));
    let common = 0;
    for (const t of sTok) if (oTok.has(t)) common++;
    const denom = Math.max(sTok.size, oTok.size, 1);
    const similarity = common / denom;
    if (similarity >= 0.7) continue; // not substantive — pure stylistic

    const before = seedA.name;
    seedA.name = omfpAscii;
    renames.push({
      code: a.code,
      before,
      after: omfpAscii,
      similarity: (similarity * 100).toFixed(0) + "%",
    });
  }

  // 4. Note type differences we KEEP (skip per Saga/practice authority)
  for (const a of omfp.accounts) {
    const s = seedByCode.get(a.code);
    if (!s) continue;
    if (s.type === a.type) continue;
    skippedTypeDiffs.push({
      code: a.code,
      seedType: s.type,
      omfpType: a.type,
      reason:
        a.code === "5121" || a.code === "5124"
          ? "Saga + Claudia: banks can have overdraft → keep B (OMFP HTML simplifies to A)"
          : a.code === "609" || a.code === "709"
          ? "Counter-balance account; Saga + accounting practice keep these inverted from class default"
          : a.code === "711"
          ? "Variatia stocurilor — Saga: B (can be sold C or sold D); OMFP HTML implies P from class"
          : "Type kept per Saga authority",
    });
  }

  // Sort accounts by code (numeric awareness)
  seed.accounts.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));

  // Bump version
  seed.version = "omfp_1802_2025_v2";
  seed.description =
    "Standard Romanian Chart of Accounts (OMFP 1802/2014 consolidated). Aligned with the official text published on lege5.ro (parsed via scripts/catalog-analysis/4-parse-omfp-html.ts) and validated against the Saga C export Plan_conturi_202604.xlsx. " +
    "Tier 1 of the 3-tier mapping architecture — read-only, shared across all tenants. " +
    "Names are stored without diacritics per accountant guidance (Claudia Solomon 1.5).";

  console.log("=== Summary ===");
  console.log(`Adds: ${adds.length}`);
  console.log(`Name swaps: ${swaps.length}`);
  console.log(`Name updates: ${renames.length}`);
  console.log(`Skipped renames (stylistic / our choice): ${skippedRenames.length}`);
  console.log(`Skipped type diffs (Saga authority): ${skippedTypeDiffs.length}`);
  console.log(`Final account count: ${seed.accounts.length}`);

  // Build markdown summary
  const md: string[] = [];
  md.push("# OMFP 1802/2014 alignment — apply summary");
  md.push("");
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  md.push("");
  md.push("Source: parsed from `docs/20260515/reglementarile-contabile-...html` (lege5.ro consolidated text).");
  md.push("");

  md.push("## Counts");
  md.push("");
  md.push(`- Accounts added: ${adds.length}`);
  md.push(`- Name swaps fixed: ${swaps.length}`);
  md.push(`- Name updates (substantive): ${renames.length}`);
  md.push(`- Renames skipped on purpose: ${skippedRenames.length}`);
  md.push(`- Type diffs kept (Saga authority): ${skippedTypeDiffs.length}`);
  md.push(`- Final account count: ${seed.accounts.length}`);
  md.push("");

  md.push("## Name swaps fixed");
  md.push("");
  md.push("| Code A | A before | A after | Code B | B before | B after |");
  md.push("|--------|----------|---------|--------|----------|---------|");
  for (const s of swaps) {
    md.push(`| ${s.codeA} | ${s.beforeA} | ${s.afterA} | ${s.codeB} | ${s.beforeB} | ${s.afterB} |`);
  }
  md.push("");

  md.push(`## Accounts added (${adds.length})`);
  md.push("");
  md.push("| Code | Type | Class | Name |");
  md.push("|------|------|-------|------|");
  for (const a of adds) {
    md.push(`| ${a.code} | ${a.type} | ${a.classDigit} | ${a.name} |`);
  }
  md.push("");

  md.push(`## Name updates (${renames.length})`);
  md.push("");
  md.push("| Code | Before | After | Similarity |");
  md.push("|------|--------|-------|------------|");
  for (const r of renames) {
    md.push(`| ${r.code} | ${r.before} | ${r.after} | ${r.similarity} |`);
  }
  md.push("");

  if (skippedTypeDiffs.length > 0) {
    md.push(`## Type diffs we KEEP (${skippedTypeDiffs.length})`);
    md.push("");
    md.push("OMFP HTML differs from our seed. We trust Saga + accounting practice.");
    md.push("");
    md.push("| Code | Seed | OMFP | Reason |");
    md.push("|------|------|------|--------|");
    for (const t of skippedTypeDiffs) {
      md.push(`| ${t.code} | ${t.seedType} | ${t.omfpType} | ${t.reason} |`);
    }
    md.push("");
  }

  if (skippedRenames.length > 0) {
    md.push(`## Renames skipped on purpose (${skippedRenames.length})`);
    md.push("");
    md.push("| Code | Reason |");
    md.push("|------|--------|");
    for (const s of skippedRenames) {
      md.push(`| ${s.code} | ${s.reason} |`);
    }
    md.push("");
  }

  writeFileSync(SUMMARY_PATH, md.join("\n"));
  console.log(`Wrote ${SUMMARY_PATH}`);

  if (APPLY) {
    writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
    console.log(`Wrote ${SEED_PATH}`);
  } else {
    console.log("DRY RUN — seed not written. Re-run with --apply.");
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/[î]/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

main();
