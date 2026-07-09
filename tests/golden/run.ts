/**
 * Golden-set runner for Costi (ADR-0005 Stage 3).
 *
 *   pnpm golden                 -- run all cases, write temp/golden-report.md
 *   pnpm golden --case <id>     -- run a single case
 *   pnpm golden --owner-doc     -- also regenerate docs/ro/costi-validare-patron.md
 *                                  (the owner-facing validation doc)
 *
 * Needs: local DB with the QHM21 journal + ANTHROPIC_API_KEY. Costs ~$2-3
 * per full run (prompt caching keeps rounds cheap). Not part of CI.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
process.env.COSTI_CFO_MODE = "on";

import { writeFileSync } from "fs";
import { GOLDEN_CASES, type GoldenCase } from "@/modules/costi/golden/cases";
import { runChecks, type CheckResult } from "@/modules/costi/golden/checks";

const GOLDEN_USER_EMAIL = process.env.GOLDEN_USER_EMAIL ?? "solomon.coriiu@costify.ro";
const CLIENT_SLUG = "qhm21-network-srl";
const REPORT_PATH = "temp/golden-report.md";
const OWNER_DOC_PATH = "docs/ro/costi-validare-patron.md";
/** Committed artifact rendered by /internal/golden-set. Full runs only. */
const ARTIFACT_PATH = "src/modules/costi/golden/latest-run.json";

interface CaseOutcome {
  gc: GoldenCase;
  text: string;
  toolNames: string[];
  checks: CheckResult[];
  durationMs: number;
  costUsd: number;
  stopReason?: string | null;
  error?: string;
}

function nowStamp(): string {
  return new Date().toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" });
}

const RETRYABLE = /connection error|econn|etimedout|fetch failed|overloaded|529|503/i;
const RETRY_DELAYS_MS = [5_000, 20_000];

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (const [attempt, delay] of RETRY_DELAYS_MS.entries()) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!RETRYABLE.test(msg)) throw err;
      console.log(`    retry ${attempt + 1} (${label}): ${msg.slice(0, 60)} — wait ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return fn();
}

/** Demote markdown headings inside Costi answers so they don't create
 *  phantom sections (and answer boxes) in the interactive doc. */
function flattenHeadings(answer: string): string {
  return answer
    .split("\n")
    .map((line) => {
      const m = line.match(/^#{1,6}\s+(.*)$/);
      return m ? `**${m[1].trim()}**` : line;
    })
    .join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const onlyCase = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
  const ownerDoc = args.includes("--owner-doc");

  const { prisma } = await import("@/lib/db");
  const { runCostiTurn } = await import("@/modules/costi/chat");
  const { computeCostUsd } = await import("@/modules/costi/pricing");

  const user = await prisma.user.findFirst({ where: { email: GOLDEN_USER_EMAIL } });
  if (!user) throw new Error(`Golden user ${GOLDEN_USER_EMAIL} not found`);
  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug: CLIENT_SLUG },
  });
  if (!client) throw new Error(`Client ${CLIENT_SLUG} not found for golden user`);

  const cases = onlyCase
    ? GOLDEN_CASES.filter((c) => c.id === onlyCase)
    : GOLDEN_CASES;
  if (cases.length === 0) throw new Error(`No case matches "${onlyCase}"`);

  const outcomes: CaseOutcome[] = [];
  let totalCost = 0;
  const runStart = Date.now();

  for (const [i, gc] of cases.entries()) {
    const avgMs = i > 0 ? (Date.now() - runStart) / i : 0;
    const eta =
      i > 0 ? ` · ETA ~${Math.ceil(((cases.length - i) * avgMs) / 60000)}min` : "";
    console.log(`\n[${i + 1}/${cases.length}] ${gc.id} — ${gc.title}${eta}`);

    for (const fact of gc.seedFacts ?? []) {
      await prisma.clientFact.upsert({
        where: { clientId_key: { clientId: client.id, key: fact.key } },
        create: { clientId: client.id, key: fact.key, value: fact.value, source: "user" },
        update: { value: fact.value },
      });
    }
    const factKeysBefore = new Set(
      (
        await prisma.clientFact.findMany({
          where: { clientId: client.id },
          select: { key: true },
        })
      ).map((f) => f.key)
    );

    const started = Date.now();
    // Service-level perf logs ([getBalanceRows] ...) would drown the
    // progress lines; keep the runner's own output clean.
    const realLog = console.log;
    const silencedLog = (...args: unknown[]) => {
      const first = typeof args[0] === "string" ? args[0] : "";
      if (first.startsWith("[")) return;
      realLog(...args);
    };
    try {
      console.log = silencedLog;
      const result = await withRetry(
        () =>
          runCostiTurn({
            userId: user.id,
            messages: [{ role: "user", content: gc.question }],
            page: gc.page,
            onToolCall: (name, ms) =>
              realLog(`    -> ${name} (${(ms / 1000).toFixed(1)}s)`),
          }),
        gc.id
      );
      console.log = realLog;
      const costUsd = computeCostUsd(result.params.model, result.usage);
      totalCost += costUsd;
      const checks = runChecks(
        { text: result.text, toolCalls: result.toolCalls },
        gc.expect
      );
      outcomes.push({
        gc,
        text: result.text,
        toolNames: result.toolCalls.map((c) => c.name),
        checks,
        durationMs: Date.now() - started,
        costUsd,
        stopReason: result.stopReason,
      });
      const failed = checks.filter((c) => c.level === "must" && !c.ok);
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `    ${failed.length === 0 ? "PASS" : `FAIL (${failed.map((f) => f.id).join("; ")})`} · ${secs}s · $${costUsd.toFixed(4)} · total $${totalCost.toFixed(2)}`
      );
    } catch (err) {
      console.log = realLog;
      outcomes.push({
        gc,
        text: "",
        toolNames: [],
        checks: [],
        durationMs: Date.now() - started,
        costUsd: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`    ERROR: ${err instanceof Error ? err.message.slice(0, 120) : err}`);
    } finally {
      console.log = realLog;
    }

    // Cases that write memory must not leave residue in the shared DB.
    const factsAfter = await prisma.clientFact.findMany({
      where: { clientId: client.id },
      select: { key: true },
    });
    const newKeys = factsAfter.map((f) => f.key).filter((k) => !factKeysBefore.has(k));
    if (newKeys.length > 0) {
      await prisma.clientFact.deleteMany({
        where: { clientId: client.id, key: { in: newKeys } },
      });
    }
  }

  const failedCases = outcomes.filter(
    (o) => o.error || o.checks.some((c) => c.level === "must" && !c.ok)
  );

  writeFileSync(REPORT_PATH, buildReport(outcomes, totalCost));
  console.log(`\n${outcomes.length - failedCases.length}/${outcomes.length} cases passed`);
  console.log(`total cost: $${totalCost.toFixed(4)}`);
  console.log(`report: ${REPORT_PATH}`);

  if (!onlyCase) {
    writeFileSync(ARTIFACT_PATH, buildArtifact(outcomes, totalCost, runStart));
    console.log(`artifact for /internal/golden-set: ${ARTIFACT_PATH}`);
  }

  if (ownerDoc) {
    writeFileSync(OWNER_DOC_PATH, buildOwnerDoc(outcomes));
    console.log(`owner validation doc: ${OWNER_DOC_PATH}`);
  }

  await prisma.$disconnect();
  process.exit(failedCases.length > 0 ? 1 : 0);
}

function buildArtifact(
  outcomes: CaseOutcome[],
  totalCost: number,
  runStart: number
): string {
  const artifact = {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - runStart,
    totals: {
      cases: outcomes.length,
      passed: outcomes.filter(
        (o) => !o.error && o.checks.every((c) => c.level !== "must" || c.ok)
      ).length,
      costUsd: Math.round(totalCost * 10000) / 10000,
    },
    cases: outcomes.map((o) => ({
      id: o.gc.id,
      title: o.gc.title,
      question: o.gc.question,
      page: o.gc.page,
      ownerReview: o.gc.ownerReview ?? false,
      status: o.error
        ? "error"
        : o.checks.every((c) => c.level !== "must" || c.ok)
          ? "pass"
          : "fail",
      error: o.error ?? null,
      checks: o.checks.map((c) => ({
        id: c.id,
        level: c.level,
        ok: c.ok,
        detail: c.detail,
      })),
      toolNames: o.toolNames,
      stopReason: o.stopReason ?? null,
      durationMs: o.durationMs,
      costUsd: o.costUsd,
      answer: o.text,
    })),
  };
  return JSON.stringify(artifact, null, 2) + "\n";
}

function buildReport(outcomes: CaseOutcome[], totalCost: number): string {
  const lines: string[] = [
    "# Golden set report",
    "",
    `Rulat: ${nowStamp()} · ${outcomes.length} cazuri · cost total $${totalCost.toFixed(4)}`,
    "",
    "| Caz | Status | Checks | Durata | Cost |",
    "|---|---|---|---|---|",
  ];
  for (const o of outcomes) {
    const failed = o.checks.filter((c) => c.level === "must" && !c.ok);
    const warns = o.checks.filter((c) => c.level === "warn" && !c.ok);
    const status = o.error ? "ERROR" : failed.length === 0 ? "PASS" : "FAIL";
    lines.push(
      `| ${o.gc.id} | ${status} | ${o.checks.length - failed.length - warns.length}/${o.checks.length}${warns.length ? ` (+${warns.length}w)` : ""} | ${(o.durationMs / 1000).toFixed(1)}s | $${o.costUsd.toFixed(4)} |`
    );
  }

  for (const o of outcomes) {
    const failed = o.checks.filter((c) => !c.ok);
    if (!o.error && failed.length === 0) continue;
    lines.push("", `## ${o.gc.id} — ${o.gc.title}`, "");
    lines.push(`Intrebare: ${o.gc.question}`, "");
    if (o.error) {
      lines.push(`Eroare: ${o.error}`);
      continue;
    }
    lines.push(
      `Tool-uri apelate: ${o.toolNames.join(", ") || "niciunul"} · stop: ${o.stopReason ?? "?"}`,
      ""
    );
    for (const c of failed) {
      lines.push(`- [${c.level}] ${c.id}: ${c.detail}`);
    }
    lines.push("", "Raspunsul complet:", "", "```", o.text, "```");
  }
  return lines.join("\n") + "\n";
}

function buildOwnerDoc(outcomes: CaseOutcome[]): string {
  const reviewCases = outcomes.filter((o) => o.gc.ownerReview && !o.error);
  const lines: string[] = [
    "# Validare Costi: raspunsurile pentru patron",
    "",
    "**Pentru cine e documentul asta.** Pentru patronul firmei QHM21, care cunoaste realitatea afacerii mai bine decat orice sistem. Mai jos sunt intrebari pe care un patron le-ar pune si raspunsurile pe care Costi (asistentul financiar din Costify) le da pe datele reale ale firmei.",
    "",
    "**Ce iti cerem.** Citeste fiecare raspuns si scrie in campul de sub el: e corect fata de realitate? E util? E clar, fara cuvinte pe care nu le folosesti? Ce ai fi intrebat in plus? Orice observatie ajuta, oricat de scurta.",
    "",
    `Raspunsurile au fost generate pe ${nowStamp()}, pe datele din jurnalul firmei pana in iunie 2026.`,
    "",
    "---",
    "",
  ];
  reviewCases.forEach((o, i) => {
    lines.push(`### ${i + 1}. ${o.gc.question}`);
    lines.push("");
    lines.push(flattenHeadings(o.text.trim()));
    lines.push("");
    lines.push("---");
    lines.push("");
  });
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
