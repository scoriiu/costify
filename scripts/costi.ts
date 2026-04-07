#!/usr/bin/env npx tsx
/**
 * Costi — Expert Contabil CLI
 * 
 * Usage:
 *   npx tsx scripts/costi.ts "Care e TVA-ul standard?"
 *   echo "Care e plafonul micro?" | npx tsx scripts/costi.ts
 * 
 * Or add alias in ~/.zshrc:
 *   alias costi='npx tsx /path/to/costify/scripts/costi.ts'
 * 
 * Then: costi "Care e impozitul pe dividende?"
 * 
 * Requires: ANTHROPIC_API_KEY in .env or environment
 */

import Anthropic from "@anthropic-ai/sdk"
import { readFileSync, readdirSync } from "fs"
import { join, resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const STRUCTURED_DIR = join(ROOT, "training/contabil/structured")
const CHUNKS_DIR = join(ROOT, "training/contabil/chunks")

function loadJSON(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(STRUCTURED_DIR, filename), "utf-8"))
}

function loadAllChunks(): string[] {
  return readdirSync(CHUNKS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(join(CHUNKS_DIR, f), "utf-8"))
}

function findRelevantChunks(question: string, allChunks: string[]): string[] {
  const q = question.toLowerCase()

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
  }

  const matchedTopics = new Set<string>()
  for (const [topic, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => q.includes(kw))) {
      matchedTopics.add(topic)
    }
  }

  if (matchedTopics.size === 0) return allChunks.slice(0, 5)

  return allChunks.filter((chunk) => {
    const chunkLower = chunk.toLowerCase()
    return [...matchedTopics].some((topic) => {
      const kws = keywords[topic]
      return kws.some((kw) => chunkLower.includes(kw))
    })
  })
}

async function main() {
  const question = process.argv.slice(2).join(" ").trim()

  if (!question) {
    console.error("Usage: costi \"întrebarea ta\"")
    process.exit(1)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    try {
      const envFile = readFileSync(join(ROOT, ".env"), "utf-8")
      for (const line of envFile.split("\n")) {
        const match = line.match(/^ANTHROPIC_API_KEY=(.+)/)
        if (match) {
          process.env.ANTHROPIC_API_KEY = match[1].trim().replace(/^["']|["']$/g, "")
          break
        }
      }
    } catch { /* no .env file */ }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Lipsește ANTHROPIC_API_KEY. Setează-l în .env sau ca variabilă de mediu:")
    console.error("  echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env")
    console.error("  # sau")
    console.error("  export ANTHROPIC_API_KEY=sk-ant-...")
    process.exit(1)
  }

  const taxRates = loadJSON("tax-rates.json")
  const calendar = loadJSON("tax-calendar.json")
  const payroll = loadJSON("payroll.json")
  const corporate = loadJSON("corporate.json")
  const penalties = loadJSON("penalties.json")

  const allChunks = loadAllChunks()
  const relevantChunks = findRelevantChunks(question, allChunks)

  const systemPrompt = `Ești Costică (Costi), expert contabil român din Costify. Răspunzi precis, cu articol de lege, în format Concluzie Sintetică.

REGULI:
- Răspunde în română
- Citează articolul de lege (ex: "art. 47 CF")
- Arată istoricul când o valoare s-a schimbat
- Încheie cu tabel Concluzie Sintetică (Punct | Afirmație | Status | Baza legală)
- Status: ✅ confirmat, ❌ incorect, ⚠️ necesită atenție
- Nu inventa valori — dacă nu știi, spune "necesită verificare"

DATE FISCALE 2026 (sursă canonică):
${JSON.stringify(taxRates, null, 2)}

CALENDAR FISCAL:
${JSON.stringify(calendar, null, 2)}

PAYROLL:
${JSON.stringify(payroll, null, 2)}

CORPORATE:
${JSON.stringify(corporate, null, 2)}

SANCȚIUNI:
${JSON.stringify(penalties, null, 2)}

CONTEXT SUPLIMENTAR (chunks relevante):
${relevantChunks.join("\n\n---\n\n")}`

  const client = new Anthropic()

  const response = await client.messages.create({
    model: "claude-haiku-4-20250414",
    max_tokens: 2048,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")

  console.log(text)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
