import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import {
  COSTI_TOOLS,
  handleToolCall,
  buildSystemPrompt,
  getChatParams,
  type ChatParams,
} from "@/modules/costi";

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

  const { messages, context } = (await request.json()) as {
    messages: ChatMessage[];
    context?: { page?: string };
  };
  if (!messages?.length) {
    return new Response("No messages provided", { status: 400 });
  }

  const { resolvePageContext } = await import("@/modules/costi/page-context");
  const pageContext = await resolvePageContext(user.id, context?.page);

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const systemPrompt = buildSystemPrompt(
    lastUserMessage?.content ?? "",
    undefined,
    pageContext
  );
  const chatParams = getChatParams();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await processWithTools(client, systemPrompt, chatParams, apiMessages, user.id, controller, encoder);
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
  params: ChatParams,
  messages: MessageParam[],
  userId: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  let currentMessages = [...messages];
  // Text emitted alongside tool calls is transition narration ("Sa verific...")
  // that the response contract forbids. We hold it back and stream only the
  // final round's text: the first thing the user reads is the answer itself.
  let heldNarration = "";

  for (let round = 0; round < params.maxToolRounds; round++) {
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: systemPrompt,
      tools: COSTI_TOOLS,
      messages: currentMessages,
    });

    const hasToolUse = response.content.some((b) => b.type === "tool_use");
    const roundText = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .filter(Boolean)
      .join("\n\n");

    if (!hasToolUse) {
      controller.enqueue(encoder.encode(roundText || heldNarration));
      return;
    }

    if (roundText) heldNarration = roundText;

    const toolResults: ContentBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
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

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: response.content as ContentBlockParam[] },
      { role: "user", content: toolResults },
    ];
  }

  // Tool-round budget exhausted without a closing text block.
  controller.enqueue(
    encoder.encode(
      heldNarration ||
        "Nu am reusit sa inchei analiza in limita de pasi. Pune o intrebare mai specifica si reiau de acolo."
    )
  );
}
