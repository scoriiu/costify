#!/usr/bin/env npx tsx
/**
 * Costi — Expert Contabil CLI
 * 
 * Usage:
 *   npx tsx scripts/costi.ts "Care e TVA-ul standard?"
 *   costi "Care e impozitul pe dividende?"  (with alias)
 * 
 * Uses Anthropic API (direct or via proxy).
 * Config priority:
 *   1. ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL from environment
 *   2. ANTHROPIC_API_KEY from .env
 *   3. OpenCode global config (proxy from ~/.config/opencode/opencode.json)
 */

import Anthropic from "@anthropic-ai/sdk"
import { readFileSync, readdirSync, existsSync } from "fs"
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

function resolveConfig(): { apiKey: string; baseURL?: string } {
  // 1. Check environment
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    }
  }

  // 2. Check project .env
  const envPath = join(ROOT, ".env")
  if (existsSync(envPath)) {
    const envFile = readFileSync(envPath, "utf-8")
    let apiKey: string | undefined
    let baseURL: string | undefined
    for (const line of envFile.split("\n")) {
      const keyMatch = line.match(/^ANTHROPIC_API_KEY=(.+)/)
      if (keyMatch) apiKey = keyMatch[1].trim().replace(/^["']|["']$/g, "")
      const urlMatch = line.match(/^ANTHROPIC_BASE_URL=(.+)/)
      if (urlMatch) baseURL = urlMatch[1].trim().replace(/^["']|["']$/g, "")
    }
    if (apiKey) return { apiKey, baseURL }
  }

  // 3. Check OpenCode global config for proxy
  const opencodeConfigPath = join(
    process.env.HOME || "~",
    ".config/opencode/opencode.json"
  )
  if (existsSync(opencodeConfigPath)) {
    try {
      const config = JSON.parse(readFileSync(opencodeConfigPath, "utf-8"))
      const baseURL = config?.provider?.anthropic?.options?.baseURL
      if (baseURL) {
        // Proxy exists — use a placeholder key (proxy handles auth)
        return { apiKey: "proxy-handled", baseURL }
      }
    } catch { /* invalid config */ }
  }

  console.error(`Lipsește ANTHROPIC_API_KEY. Opțiuni:

  1. Adaugă în .env:
     echo 'ANTHROPIC_API_KEY=sk-ant-...' >> ${join(ROOT, ".env")}

  2. Sau ca variabilă de mediu:
     export ANTHROPIC_API_KEY=sk-ant-...

  3. Sau configurează un proxy în ~/.config/opencode/opencode.json`)
  process.exit(1)
}

async function main() {
  const question = process.argv.slice(2).join(" ").trim()

  if (!question) {
    console.error("Usage: costi \"întrebarea ta\"")
    process.exit(1)
  }

  const { apiKey, baseURL } = resolveConfig()

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

  const clientOptions: Record<string, unknown> = { apiKey }
  if (baseURL) clientOptions.baseURL = baseURL

  const client = new Anthropic(clientOptions as ConstructorParameters<typeof Anthropic>[0])

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
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
