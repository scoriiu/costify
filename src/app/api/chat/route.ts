import { runCostiTurn, type ChatMessage, type TurnUsage } from "@/modules/costi/chat";
import { computeCostUsd } from "@/modules/costi/pricing";

async function recordChatUsage(
  userId: string,
  model: string,
  usage: TurnUsage,
  page: string | undefined,
  durationMs: number
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.chatUsage.create({
      data: {
        userId,
        model,
        rounds: usage.rounds,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        cacheReadTokens: usage.cacheReadTokens,
        costUsd: computeCostUsd(model, usage),
        page: page ?? null,
        durationMs,
      },
    });
  } catch (err) {
    // Accounting must never break the chat itself.
    console.error("chat usage record failed:", err);
  }
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

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runCostiTurn({
          userId: user.id,
          messages,
          page: context?.page,
          onText: (chunk) => controller.enqueue(encoder.encode(chunk)),
        });
        if (result.usage.rounds > 0) {
          await recordChatUsage(
            user.id,
            result.params.model,
            result.usage,
            context?.page,
            Date.now() - startedAt
          );
        }
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
