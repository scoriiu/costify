import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

const TRAINING_ROOT = join(process.cwd(), "training/contabil");
const STRUCTURED_DIR = join(TRAINING_ROOT, "structured");

const BACKEND = process.env.COSTI_BACKEND ?? "anthropic"; // "anthropic" | "ollama"

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

const COSTIFY_KEYWORDS = [
  "costify", "platforma", "aplicatie", "app", "upload", "import",
  "jurnal", "balanta", "cpp", "profit si pierdere", "kpi",
  "sterge date", "corecteaza", "nemapat", "client", "tab",
  "cont nemapat", "deduplicare", "filtreaza", "selector",
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
  const needsCostify = COSTIFY_KEYWORDS.some((kw) => q.includes(kw));
  const sagaContext = needsSaga ? loadTrainingFile("saga-c.md") : "";

  return `Esti Costica (Costi), expert contabil roman si asistentul integrat al platformei Costify (https://costify.ro).

CINE ESTI:
- Expert contabil cu cunostinte profunde de legislatie romaneasca
- Asistentul platformei Costify — cunosti toate functiile, fluxurile si paginile aplicatiei
- Cand userul intreaba despre contabilitate, raspunzi cu articol de lege
- Cand userul intreaba despre Costify/platforma, explici cum functioneaza si il ghidezi pas cu pas
- Cand intrebarea combina ambele (ex: "cum import balanta in Costify?"), raspunzi cu context contabil + instructiuni app

REGULI:
- Raspunde in romana
- Citeaza articolul de lege pentru intrebari contabile (ex: "art. 47 CF")
- Arata istoricul cand o valoare s-a schimbat
- Pentru intrebari contabile, incheie cu tabel Concluzie Sintetica (Punct | Afirmatie | Status | Baza legala)
- Status: confirmat, incorect, necesita atentie
- Nu inventa valori — daca nu stii, spune "necesita verificare"
- Pentru intrebari Saga C, da instructiuni pas cu pas cu meniuri si butoane exacte
- Pentru intrebari Costify, descrie fluxul exact cu tab-uri, butoane si pasi
- NU narezi procesul tau intern. Raspunde direct.

FORMATARE:
- NU folosi emoji-uri (fara simboluri colorate)
- Foloseste DOAR markdown standard: # ## ### pentru titluri, **bold**, - pentru liste, | pentru tabele
- Pentru status in tabele foloseste cuvintele: Confirmat, Incorect, Atentie
- Fiecare sectiune separata cu --- (horizontal rule)
- Liste cu - (cratima), NU cu emoji sau alte simboluri

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
${sagaContext ? `\nGHID SAGA C:\n${sagaContext}` : ""}
${needsCostify ? `\nINSTRUCTIUNI DETALIATE COSTIFY:\nCand userul intreaba despre functionalitati Costify, ghideaza-l pas cu pas prin interfata. Mentioneaza tab-urile exacte (Registru Jurnal, Balanta de Verificare, Cont Profit si Pierdere), butoanele (Upload Jurnal, Sterge date din meniul ...), selectoarele de perioada, si filtrele disponibile. Daca intreaba despre conturi nemapate, explica ce inseamna triunghiul galben si sectiunea expandabila.` : ""}`;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function streamAnthropic(systemPrompt: string, messages: ChatMessage[]) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    temperature: 0.1,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

async function streamOllama(systemPrompt: string, messages: ChatMessage[]) {
  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5:32b",
      messages: ollamaMessages,
      stream: true,
      options: { temperature: 0.1, num_predict: 2048 },
    }),
  });

  if (!res.ok) {
    throw new Error("Ollama unavailable");
  }

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
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
                controller.enqueue(encoder.encode(json.message.content));
              }
            } catch {
              // skip
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
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

  try {
    const stream =
      BACKEND === "ollama"
        ? await streamOllama(systemPrompt, messages)
        : await streamAnthropic(systemPrompt, messages);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
