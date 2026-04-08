import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { COSTI_TOOLS, handleToolCall } from "@/modules/costi";

const TRAINING_ROOT = join(process.cwd(), "training/contabil");
const STRUCTURED_DIR = join(TRAINING_ROOT, "structured");
const MAX_TOOL_ROUNDS = 5;

function loadJSON(filename: string): Record<string, unknown> {
  const path = join(STRUCTURED_DIR, filename);
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadTrainingFile(filename: string): string {
  const path = join(TRAINING_ROOT, filename);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

const SAGA_KEYWORDS = [
  "saga", "inchidere luna", "validare", "devalidare", "configurare societati",
  "conturi automate", "nomenclat", "gestiune global", "coeficient k",
  "registru casa", "jurnal banca", "stat de plata", "nir", "fisa cont",
  "cartea mare", "spv", "d100", "d101", "d700", "diferente curs",
];

function buildSystemPrompt(question: string): string {
  const taxRates = loadJSON("tax-rates.json");
  const calendar = loadJSON("tax-calendar.json");
  const payroll = loadJSON("payroll.json");
  const corporate = loadJSON("corporate.json");
  const penalties = loadJSON("penalties.json");
  const costifyApp = loadJSON("costify-app.json");

  const q = question.toLowerCase();
  const needsSaga = SAGA_KEYWORDS.some((kw) => q.includes(kw));
  const sagaContext = needsSaga ? loadTrainingFile("saga-c.md") : "";

  return `Esti Costica (Costi), expert contabil roman si asistentul integrat al platformei Costify (https://costify.ro).

CINE ESTI:
- Expert contabil cu cunostinte profunde de legislatie romaneasca
- Asistentul platformei Costify — cunosti toate functiile, fluxurile si paginile aplicatiei
- Ai acces la datele financiare ale clientilor utilizatorului prin tool-uri (functii)
- Cand userul intreaba despre un client specific, FOLOSESTE tool-urile pentru a obtine date reale
- Nu inventa cifre — daca nu ai date, foloseste tool-ul corespunzator

REGULI TOOL-URI:
- Foloseste list_clients pentru a vedea ce clienti are userul
- Foloseste get_client_kpis, get_balance, get_cpp, get_journal_entries pentru date financiare
- Foloseste get_available_periods pentru a vedea ce perioade sunt disponibile
- INTOTDEAUNA verifica datele prin tool-uri inainte sa raspunzi cu cifre
- Poti combina mai multe tool-uri pentru a raspunde la intrebari complexe

REGULI GENERALE:
- Raspunde in romana
- Citeaza articolul de lege pentru intrebari contabile (ex: "art. 47 CF")
- Pentru intrebari contabile, incheie cu tabel Concluzie Sintetica (Punct | Afirmatie | Status | Baza legala)
- Status: confirmat, incorect, necesita atentie
- Nu inventa valori — daca nu stii, spune "necesita verificare"
- Pentru intrebari Saga C, da instructiuni pas cu pas cu meniuri si butoane exacte
- Pentru intrebari Costify, descrie fluxul exact cu tab-uri, butoane si pasi
- NU narezi procesul tau intern. Raspunde direct cu rezultatele.

FORMATARE:
- NU folosi emoji-uri (fara simboluri colorate)
- Foloseste DOAR markdown standard: # ## ### pentru titluri, **bold**, - pentru liste, | pentru tabele
- Pentru status in tabele foloseste cuvintele: Confirmat, Incorect, Atentie
- Fiecare sectiune separata cu --- (horizontal rule)
- Liste cu - (cratima), NU cu emoji sau alte simboluri
- Numerele financiare in format romanesc (1.234,56 RON)

PLATFORMA COSTIFY:
${JSON.stringify(costifyApp, null, 2)}

DATE FISCALE 2026:
${JSON.stringify(taxRates, null, 2)}

CALENDAR FISCAL:
${JSON.stringify(calendar, null, 2)}

PAYROLL:
${JSON.stringify(payroll, null, 2)}

CORPORATE:
${JSON.stringify(corporate, null, 2)}

SANCTIUNI:
${JSON.stringify(penalties, null, 2)}
${sagaContext ? `\nGHID SAGA C:\n${sagaContext}` : ""}`;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const { getSessionUser } = await import("@/modules/auth/session");
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = (await request.json()) as { messages: ChatMessage[] };
  if (!messages?.length) {
    return new Response("No messages provided", { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const systemPrompt = buildSystemPrompt(lastUserMessage?.content ?? "");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await processWithTools(client, systemPrompt, apiMessages, user.id, controller, encoder);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\nEroare: ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

async function processWithTools(
  client: Anthropic,
  systemPrompt: string,
  messages: MessageParam[],
  userId: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  let currentMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      temperature: 0.1,
      system: systemPrompt,
      tools: COSTI_TOOLS,
      messages: currentMessages,
    });

    let hasToolUse = false;
    const toolResults: ContentBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        controller.enqueue(encoder.encode(block.text));
      }

      if (block.type === "tool_use") {
        hasToolUse = true;
        const result = await handleToolCall(
          userId,
          block.name,
          block.input as Record<string, unknown>
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        } as ContentBlockParam);
      }
    }

    if (!hasToolUse) break;

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content as ContentBlockParam[] },
      { role: "user", content: toolResults },
    ];
  }
}
