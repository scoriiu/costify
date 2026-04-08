#!/usr/bin/env npx tsx
/**
 * Costi Local — Expert Contabil CLI (Ollama / Qwen 2.5 32B)
 * 
 * Usage:
 *   npx tsx scripts/costi-local.ts "Care e TVA-ul standard?"
 *   costil "Care e impozitul pe dividende?"  (with alias)
 * 
 * Uses local Ollama server at http://localhost:11434
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STRUCTURED_DIR = join(ROOT, "training/contabil/structured");
const CHUNKS_DIR = join(ROOT, "training/contabil/chunks");
const TRAINING_DIR = join(ROOT, "training/contabil");

function loadJSON(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(STRUCTURED_DIR, filename), "utf-8"));
}

function loadAllChunks(): string[] {
  return readdirSync(CHUNKS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(join(CHUNKS_DIR, f), "utf-8"));
}

function findRelevantChunks(question: string, allChunks: string[]): string[] {
  const q = question.toLowerCase();

  const keywords: Record<string, string[]> = {
    micro: ["micro", "microintreprindere", "1%", "3%", "100.000"],
    tva: ["tva", "taxa", "valoare adaugata", "21%", "11%", "plafon tva", "d300", "decont"],
    profit: ["profit", "impozit pe profit", "16%", "cheltuieli deductibile", "nedeductibile", "sponsorizare"],
    dividende: ["dividend", "dividende", "repartizare profit"],
    salariu: ["salariu", "salarizare", "payroll", "cas", "cass", "cam", "d112", "brut", "net", "contributii"],
    creante: ["creante", "ajustari", "depreciere creante", "270 zile", "30%", "insolventa"],
    factura: ["factura", "e-factura", "elemente obligatorii", "xml"],
    stocuri: ["stocuri", "depreciere stocuri", "394", "valoare realizabila"],
    provizion: ["provizion", "ajustare", "diferenta provizion"],
    bilant: ["bilant", "situatii financiare", "cont profit", "note explicative"],
    inspectie: ["inspectie", "control fiscal", "contestatie", "prescriptie", "decizie impunere"],
    copyright: ["drepturi de autor", "copyright", "40%", "cheltuieli forfetare"],
    investitii: ["investitii", "cass investitii", "castig capital", "cesiune parti sociale"],
    intracomunitar: ["intracomunitar", "livrare intracomunitara", "reverse charge", "taxare inversa"],
    imobil: ["imobil", "ajustare tva", "20 ani", "vanzare imobil", "cladire"],
    beneficii: ["tichete", "masa", "avantaje natura", "beneficii"],
    saga: ["saga", "saga c", "inchidere luna", "validare", "devalidare", "configurare societati", "conturi automate", "nomenclat", "gestiune global", "coeficient k", "registru casa", "jurnal banca", "stat de plata", "nir", "fisa cont", "cartea mare", "balanta", "spv", "d100", "d101", "d700", "diferente curs"],
  };

  const matchedTopics = new Set<string>();
  for (const [topic, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => q.includes(kw))) {
      matchedTopics.add(topic);
    }
  }

  if (matchedTopics.size === 0) return allChunks.slice(0, 5);

  const matched = allChunks.filter((chunk) => {
    const chunkLower = chunk.toLowerCase();
    return [...matchedTopics].some((topic) => {
      const kws = keywords[topic];
      return kws.some((kw) => chunkLower.includes(kw));
    });
  });

  if (matchedTopics.has("saga")) {
    const sagaPath = join(TRAINING_DIR, "saga-c.md");
    if (existsSync(sagaPath)) {
      matched.push(readFileSync(sagaPath, "utf-8"));
    }
  }

  return matched;
}

async function main() {
  const question = process.argv.slice(2).join(" ").trim();

  if (!question) {
    console.error("Usage: costil \"intrebarea ta\"");
    process.exit(1);
  }

  const taxRates = loadJSON("tax-rates.json");
  const calendar = loadJSON("tax-calendar.json");
  const payroll = loadJSON("payroll.json");
  const corporate = loadJSON("corporate.json");
  const penalties = loadJSON("penalties.json");

  const allChunks = loadAllChunks();
  const relevantChunks = findRelevantChunks(question, allChunks);

  const systemPrompt = `Esti Costica (Costi), expert contabil roman din Costify. Raspunzi precis, cu articol de lege, in format Concluzie Sintetica.

REGULI:
- Raspunde in romana
- Citeaza articolul de lege (ex: "art. 47 CF")
- Arata istoricul cand o valoare s-a schimbat
- Incheie cu tabel Concluzie Sintetica (Punct | Afirmatie | Status | Baza legala)
- Status: confirmat, incorect, necesita atentie
- Nu inventa valori — daca nu stii, spune "necesita verificare"

DATE FISCALE 2026 (sursa canonica):
${JSON.stringify(taxRates, null, 2)}

CALENDAR FISCAL:
${JSON.stringify(calendar, null, 2)}

PAYROLL:
${JSON.stringify(payroll, null, 2)}

CORPORATE:
${JSON.stringify(corporate, null, 2)}

SANCTIUNI:
${JSON.stringify(penalties, null, 2)}

CONTEXT SUPLIMENTAR (chunks relevante):
${relevantChunks.join("\n\n---\n\n")}`;

  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:32b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      stream: true,
      options: { temperature: 0.1, num_predict: 2048 },
    }),
  });

  if (!res.ok) {
    console.error("Ollama nu ruleaza. Porneste cu: ollama serve");
    console.error("Model necesar: ollama pull qwen2.5:32b");
    process.exit(1);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) {
          process.stdout.write(json.message.content);
        }
      } catch {
        // skip
      }
    }
  }

  console.log();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
