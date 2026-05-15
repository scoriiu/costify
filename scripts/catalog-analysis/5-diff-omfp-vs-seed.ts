#!/usr/bin/env tsx
/**
 * Diff the parsed OMFP HTML against our current seed.
 *
 * Three buckets in output:
 *   missing:     accounts in OMFP but not in our seed (we should add them)
 *   typeDiff:    accounts in both but type differs (OMFP wins for class 1-5,
 *                we keep our Saga-validated B for 401 etc. — flag for review)
 *   nameDiff:    accounts in both but name differs significantly (normalize
 *                both to ASCII, strip whitespace, compare; report mismatches
 *                for manual review)
 *   onlyInSeed:  accounts in our seed but not in OMFP (extensions like 999)
 *
 * Output: temp/omfp-vs-seed-diff.json + a readable markdown summary.
 *
 * No mutations. Inspection only. Decisions about which diffs to apply
 * are taken manually after reviewing the markdown.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const OMFP_PATH = join(ROOT, "temp", "omfp-1802-parsed.json");
const SEED_PATH = join(ROOT, "seeds", "omfp-1802.json");
const OUT_JSON = join(ROOT, "temp", "omfp-vs-seed-diff.json");
const OUT_MD = join(ROOT, "temp", "omfp-vs-seed-diff.md");

interface OmfpAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
  classDigit: number;
  groupCode: string;
  hasFootnote: boolean;
  className: string;
}

interface SeedAccount {
  code: string;
  name: string;
  type: "A" | "P" | "B";
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

function main() {
  const omfp = JSON.parse(readFileSync(OMFP_PATH, "utf-8")) as {
    accounts: OmfpAccount[];
  };
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf-8")) as {
    accounts: SeedAccount[];
  };

  const omfpByCode = new Map(omfp.accounts.map((a) => [a.code, a]));
  const seedByCode = new Map(seed.accounts.map((a) => [a.code, a]));

  const missing: OmfpAccount[] = [];
  const typeDiff: Array<{ code: string; name: string; seed: string; omfp: string }> = [];
  const nameDiff: Array<{
    code: string;
    seedName: string;
    omfpName: string;
    similarity: number;
  }> = [];
  const onlyInSeed: Array<{ code: string; name: string; type: string }> = [];

  for (const a of omfp.accounts) {
    const s = seedByCode.get(a.code);
    if (!s) {
      missing.push(a);
      continue;
    }
    if (s.type !== a.type) {
      typeDiff.push({
        code: a.code,
        name: a.name,
        seed: s.type,
        omfp: a.type,
      });
    }
    const sn = normalize(s.name);
    const on = normalize(a.name);
    if (sn !== on) {
      // Token overlap to filter pure caps/abbreviation differences
      const sTok = new Set(sn.split(" ").filter((w) => w.length > 3));
      const oTok = new Set(on.split(" ").filter((w) => w.length > 3));
      let common = 0;
      for (const t of sTok) if (oTok.has(t)) common++;
      const denom = Math.max(sTok.size, oTok.size, 1);
      const similarity = common / denom;
      if (similarity < 0.7) {
        nameDiff.push({
          code: a.code,
          seedName: s.name,
          omfpName: a.name,
          similarity,
        });
      }
    }
  }

  for (const s of seed.accounts) {
    if (!omfpByCode.has(s.code)) {
      onlyInSeed.push({ code: s.code, name: s.name, type: s.type });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    counts: {
      omfpTotal: omfp.accounts.length,
      seedTotal: seed.accounts.length,
      missingFromSeed: missing.length,
      typeDiff: typeDiff.length,
      nameDiff: nameDiff.length,
      onlyInSeed: onlyInSeed.length,
    },
    missing,
    typeDiff,
    nameDiff,
    onlyInSeed,
  };
  writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));

  // Build markdown
  const md: string[] = [];
  md.push("# OMFP 1802/2014 (consolidated HTML) vs current seed");
  md.push("");
  md.push(`Generated: ${summary.generatedAt}`);
  md.push("");
  md.push("## Counts");
  md.push("");
  md.push(`- OMFP HTML accounts: ${summary.counts.omfpTotal}`);
  md.push(`- Current seed accounts: ${summary.counts.seedTotal}`);
  md.push(`- Missing from seed: ${summary.counts.missingFromSeed}`);
  md.push(`- Type differences: ${summary.counts.typeDiff}`);
  md.push(`- Name differences (substantive, <70% token overlap): ${summary.counts.nameDiff}`);
  md.push(`- Only in seed (extensions like 999, 6422, 6461 etc.): ${summary.counts.onlyInSeed}`);
  md.push("");

  if (missing.length > 0) {
    md.push("## Missing from seed (in OMFP but not in our catalog)");
    md.push("");
    md.push("| Code | Type | Name |");
    md.push("|------|------|------|");
    for (const a of missing) {
      md.push(`| ${a.code} | ${a.type} | ${a.name} |`);
    }
    md.push("");
  }

  if (typeDiff.length > 0) {
    md.push("## Type differences (A/P/B)");
    md.push("");
    md.push("| Code | Name | Seed | OMFP |");
    md.push("|------|------|------|------|");
    for (const d of typeDiff) {
      md.push(`| ${d.code} | ${d.name} | **${d.seed}** | **${d.omfp}** |`);
    }
    md.push("");
  }

  if (nameDiff.length > 0) {
    md.push("## Substantive name differences");
    md.push("");
    md.push("These are different enough to require attention. Token overlap < 70%.");
    md.push("");
    md.push("| Code | Seed | OMFP | Overlap |");
    md.push("|------|------|------|---------|");
    for (const d of nameDiff) {
      md.push(
        `| ${d.code} | ${d.seedName} | ${d.omfpName} | ${(d.similarity * 100).toFixed(0)}% |`
      );
    }
    md.push("");
  }

  if (onlyInSeed.length > 0) {
    md.push("## Only in seed (extensions we kept)");
    md.push("");
    md.push("These are accounts we added that aren't in the consolidated OMFP HTML.");
    md.push("Most are Saga conventions (999) or our backfill for production accounts.");
    md.push("");
    md.push("| Code | Type | Name |");
    md.push("|------|------|------|");
    for (const s of onlyInSeed) {
      md.push(`| ${s.code} | ${s.type} | ${s.name} |`);
    }
    md.push("");
  }

  writeFileSync(OUT_MD, md.join("\n"));

  console.log("=== Summary ===");
  console.log(JSON.stringify(summary.counts, null, 2));
  console.log("");
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
}

main();
