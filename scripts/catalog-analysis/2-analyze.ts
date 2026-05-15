#!/usr/bin/env tsx
/**
 * Catalog analysis — step 2: ask Claude for a structured proposal.
 *
 * Reads temp/catalog-delta-input.json (built by step 1) and sends it to
 * Claude with a clear, narrow task: produce JSON corrections to the seed.
 *
 * No mutations. Output is review-only:
 *   - temp/catalog-delta-proposal.json (structured, for diffing/applying later)
 *   - temp/catalog-delta-review.md     (human-readable for the team)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npx tsx scripts/catalog-analysis/2-analyze.ts
 *
 * Cost: this sends ~50K tokens of input and asks for a structured JSON
 * output. Using Sonnet 4.5 for accuracy. Single call, no tool use.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const INPUT_PATH = join(ROOT, "temp", "catalog-delta-input.json");
const PROPOSAL_PATH = join(ROOT, "temp", "catalog-delta-proposal.json");
const REVIEW_PATH = join(ROOT, "temp", "catalog-delta-review.md");

const MODEL = "claude-sonnet-4-5-20250929";

if (!existsSync(INPUT_PATH)) {
  console.error(`Missing ${INPUT_PATH}. Run step 1 first:`);
  console.error(`  npx tsx scripts/catalog-analysis/1-build-input.ts`);
  process.exit(1);
}

// Load .env so ANTHROPIC_API_KEY is available without explicit export.
function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.+?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadDotEnv();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const SYSTEM_PROMPT = `Esti Costi, asistentul Costify si expert in contabilitate romaneasca. Sarcina ta acum nu este conversationala — esti rugat sa analizezi calitatea unui catalog de conturi (planul de conturi OMFP 1802) si sa produci un set de corectii structurate.

Inputurile pe care le primesti sunt:

1. **seed** (324 conturi) — catalogul actual din Costify (\`seeds/omfp-1802.json\`). Pentru fiecare cont: \`code\`, \`name\`, \`type\` (A/P/B), \`cppGroup\`, \`cppLine\` (rand F20), si flag-uri (isClosing, isProfitTax, isExtraBilantier, cashRole, arRole, apRole, vatRole, payrollRole).

2. **saga** (583 conturi) — exportul OFICIAL din Saga al planului de conturi OMFP 1802 actualizat. Are: \`code\`, \`name\`, \`type\`. Asta e sursa de adevar pentru denumirile oficiale OMFP.

3. **answers** (40+ raspunsuri de la contabilul Claudia Solomon) — practician cu zeci de clienti in cabinet. A raspuns la intrebari concrete despre mapari, KPI-uri, conturi speciale, conventii Saga. Citeste-le TOATE inainte sa propui ceva.

4. **journalUsage** — conturi care apar in jurnalele reale ale clientilor in productie. \`occurrences\` = de cate ori apar, \`inSeed\` = sunt in catalog, \`inSaga\` = exista in plan oficial, \`sampleExplicatii\` = exemple de explicatii din jurnal (te ajuta sa intelegi semantica reala).

5. **deltas** — diferentele deja calculate intre seed si saga.

## Ce trebuie sa produci

Un singur obiect JSON cu urmatoarea forma exacta:

\`\`\`json
{
  "summary": {
    "totalCorrections": <number>,
    "renames": <number>,
    "retypes": <number>,
    "newAccounts": <number>,
    "cppLineFixes": <number>,
    "flagFixes": <number>
  },
  "corrections": [
    {
      "code": "643",
      "type": "rename" | "retype" | "new" | "cppLine" | "flag" | "delete",
      "rationale": "scurt, in romana, EXACT de ce. Citeaza sursa: 'Saga oficial', 'Claudia raspuns X.Y', 'OMFP 1802 art. Z'. Daca nu ai sursa, nu propune.",
      "currentValue": "ce e acum in seed (sau null daca e cont nou)",
      "proposedValue": "ce ar trebui sa fie",
      "confidence": "high" | "medium" | "low",
      "fields": {
        // numai campurile care se schimba; le omiti pe restul
        "name": "...",
        "type": "A" | "P" | "B",
        "cppGroup": "...",
        "cppLine": "...",
        "cppLineLabel": "...",
        "isClosing": true,
        // etc.
      }
    }
  ],
  "openQuestions": [
    "Intrebari pe care nu poti sa le rezolvi singur si trebuie escaladate la Claudia."
  ],
  "skipped": [
    {
      "code": "...",
      "reason": "De ce NU ai propus o corectie chiar daca e in delta. (ex: 'diferenta e doar stilistica, denumirea noastra e mai completa decat prescurtarea Saga')"
    }
  ]
}
\`\`\`

## Reguli importante

1. **Diferentele stilistice NU sunt corectii.** Daca seed-ul are "Imprumuturi din emisiuni de obligatiuni" si Saga are "IMPR. DIN EMISIUNI DE OBLIGATIUNI", e doar caps/abrevierea Saga. Nu o propune ca rename.

2. **Diferenta de tip A/P/B intre seed si Saga e o corectie reala.** Saga e sursa de adevar pentru tip. Propune retype.

3. **Conturi care apar in journalUsage cu inSeed=false dar inSaga=true** sunt prioritate maxima — sunt folosite in productie si lipsesc din catalog. Propune "new" pentru fiecare cu denumirea si tipul din Saga.

4. **Conturi care apar in journalUsage cu inSeed=false si inSaga=false** sunt cazuri speciale. Verifica raspunsurile Claudiei — la 999 a spus explicit ca e tehnic Saga, nu OMFP. La 4373 e cont real OMFP introdus prin OMFP 4291/2022. Decide caz cu caz.

5. **cppLine** — fixeaza-le doar acolo unde Claudia a dat explicit alta valoare in raspunsuri (sectiunile 1.x si 2.x din doc-ul intrebari-contabil-f20-detaliat). Pentru conturile noi, propune cppLine doar daca esti sigur.

6. **643 si 644 sunt SWAPPED in seed.** Saga arata clar: 643="CHELT. CU REMUNERAREA IN INSTRUMENTE DE CAPITALURI PROPRII", 644="CHELT. CU PRIMELE REPREZENTAND PARTICIPAREA LA PROFIT". Seed-ul nostru le are invers la denumiri. Asta e bug-ul principal. Verifica si propune ambele renumiri.

7. **121 are tip B in Saga, dar in F20 e tratat special.** Nu schimba flag-ul isClosing existent — Claudia a confirmat ca tratamentul actual (exclus din CPP, prezent in bilant) e corect.

8. **Conturile clasei 8 si 9** — Claudia a confirmat ca toate sunt extra-bilantiere. Daca seed-ul nu are isExtraBilantier=true pentru un cont 8xx/9xx, propune flag fix.

9. **Output-ul tau trebuie sa fie JSON valid si parsabil.** Fara markdown, fara comentarii intre acolade, doar JSON pur. Daca explicatia e lunga, pune-o in field-ul "rationale", nu in afara JSON-ului.

10. **Confidence levels**:
    - **high**: Saga + Claudia + un alt input confirma in acelasi sens. Aplica fara discutie.
    - **medium**: Doar Saga sau doar Claudia, dar e foarte clar. Aplica dupa o privire.
    - **low**: Inferenta din nume + clasa, fara confirmare directa. Necesita revizuire umana.

11. **Daca nu esti sigur pe un cont, NU il propune.** Pune-l in \`openQuestions\` cu intrebarea specifica pentru Claudia.

12. **Prioritizeaza in aceasta ordine**:
    a) Bug-urile (643/644 swap, 107 denumire greșită, alte denumiri factual greșite)
    b) Tipurile A/P/B unde Saga disagree
    c) Conturile lipsa din seed dar prezente in productie (din journalUsage)
    d) Conturile lipsa din seed dar prezente in Saga (lista completa OMFP)
    e) cppLine fixes per raspunsurile Claudiei
    f) Flag fixes (isExtraBilantier, cashRole etc.)

Pentru contextul referintelor: F20 = formularul oficial ANAF "Cont de profit si pierdere" anexa OMFP 1802. cppLine se refera la randurile 01-35 din acel formular (sau sub-randuri 13a, 14a, 14b, 15a, 15b, 16a, 16b, 17a, 17b, 17c, 17d, 18a, 18b, 26a, 26b, 34).

Du-te.`;

async function main() {
  console.log(`Loading input from ${INPUT_PATH}...`);
  const inputRaw = readFileSync(INPUT_PATH, "utf-8");
  const inputSizeKB = (inputRaw.length / 1024).toFixed(1);
  console.log(`Input size: ${inputSizeKB} KB`);

  const client = new Anthropic();

  console.log(`Sending to ${MODEL}... (this takes 30-90s)`);
  const start = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Iata bundle-ul cu inputurile. Citeste TOT cu atentie, citeste TOATE raspunsurile Claudiei, apoi produ proposal-ul JSON.\n\n<bundle>\n${inputRaw}\n</bundle>\n\nProdu acum JSON-ul. Doar JSON, fara nimic in plus.`,
          },
        ],
      },
    ],
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Response received in ${elapsed}s`);
  console.log(
    `Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`
  );

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON found in response. Full response:");
    console.error(text);
    process.exit(1);
  }

  let proposal: {
    summary: Record<string, number>;
    corrections: Array<Record<string, unknown>>;
    openQuestions: string[];
    skipped: Array<{ code: string; reason: string }>;
  };
  try {
    proposal = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse JSON proposal:");
    console.error((e as Error).message);
    writeFileSync(PROPOSAL_PATH + ".raw.txt", text);
    console.error(`Raw output saved to ${PROPOSAL_PATH}.raw.txt`);
    process.exit(1);
  }

  mkdirSync(join(ROOT, "temp"), { recursive: true });
  writeFileSync(PROPOSAL_PATH, JSON.stringify(proposal, null, 2));
  console.log(`\nWrote ${PROPOSAL_PATH}`);
  console.log(`Summary: ${JSON.stringify(proposal.summary)}`);

  writeFileSync(REVIEW_PATH, renderReview(proposal));
  console.log(`Wrote ${REVIEW_PATH}`);
}

function renderReview(p: {
  summary: Record<string, number>;
  corrections: Array<Record<string, unknown>>;
  openQuestions: string[];
  skipped: Array<{ code: string; reason: string }>;
}): string {
  const lines: string[] = [];
  lines.push("# Catalog delta proposal");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Model: ${MODEL}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  for (const [k, v] of Object.entries(p.summary)) {
    lines.push(`- **${k}**: ${v}`);
  }
  lines.push("");

  const byType = new Map<string, Array<Record<string, unknown>>>();
  for (const c of p.corrections) {
    const t = String(c.type);
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(c);
  }

  for (const [type, items] of byType) {
    lines.push(`## ${type} (${items.length})`);
    lines.push("");
    for (const c of items) {
      lines.push(`### ${c.code} — confidence: ${c.confidence}`);
      lines.push("");
      lines.push(`**Rationale**: ${c.rationale}`);
      lines.push("");
      if (c.currentValue !== undefined && c.currentValue !== null) {
        lines.push(`**Current**: \`${JSON.stringify(c.currentValue)}\``);
      }
      if (c.proposedValue !== undefined && c.proposedValue !== null) {
        lines.push(`**Proposed**: \`${JSON.stringify(c.proposedValue)}\``);
      }
      if (c.fields) {
        lines.push("**Fields**:");
        lines.push("```json");
        lines.push(JSON.stringify(c.fields, null, 2));
        lines.push("```");
      }
      lines.push("");
    }
  }

  if (p.openQuestions.length > 0) {
    lines.push("## Open questions for Claudia");
    lines.push("");
    for (const q of p.openQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  if (p.skipped.length > 0) {
    lines.push(`## Skipped (${p.skipped.length})`);
    lines.push("");
    for (const s of p.skipped) {
      lines.push(`- **${s.code}**: ${s.reason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
