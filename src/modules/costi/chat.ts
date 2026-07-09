/**
 * Costi's chat turn, decoupled from HTTP so the same loop serves both the
 * API route (streaming) and the golden-set evaluator (direct invocation
 * with full tool-call transcript).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { COSTI_TOOLS } from "./tools";
import { handleToolCall } from "./tool-handlers";
import { buildSystemPrompt, getChatParams, type ChatParams } from "./prompt";
import { resolvePageContext } from "./page-context";
import type { UsageTotals } from "./pricing";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallRecord {
  round: number;
  name: string;
  input: Record<string, unknown>;
  /** JSON string returned by the handler. */
  result: string;
}

export interface TurnUsage extends UsageTotals {
  rounds: number;
}

export interface TurnResult {
  /** The final answer streamed to the user. */
  text: string;
  toolCalls: ToolCallRecord[];
  usage: TurnUsage;
  /** Narration text the model emitted alongside tool calls (held back). */
  heldNarration: string;
  params: ChatParams;
  /** stop_reason of the last API response (diagnostics for empty answers). */
  stopReason: string | null;
}

export interface RunTurnOptions {
  userId: string;
  messages: ChatMessage[];
  /** App location the question was asked from (pathname + query). */
  page?: string;
  /** Streamed chunks of the final answer, for the HTTP route. */
  onText?: (chunk: string) => void;
  /** Progress signal: fires after each tool call completes (golden runner). */
  onToolCall?: (name: string, durationMs: number) => void;
  /** Test override; defaults to env-driven params. */
  paramsOverride?: ChatParams;
}

const ROUNDS_EXHAUSTED_MESSAGE =
  "Nu am reusit sa inchei analiza in limita de pasi. Pune o intrebare mai specifica si reiau de acolo.";
const EMPTY_ANSWER_MESSAGE =
  "Analiza a iesit prea lunga si s-a intrerupt. Pune intrebarea din nou, eventual pe o singura tema, si raspund direct.";

export async function runCostiTurn(options: RunTurnOptions): Promise<TurnResult> {
  const { userId, messages, page, onText } = options;

  const pageContext = await resolvePageContext(userId, page);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const systemPrompt = buildSystemPrompt(
    lastUserMessage?.content ?? "",
    undefined,
    pageContext
  );
  const params = options.paramsOverride ?? getChatParams();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let currentMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const usage: TurnUsage = {
    rounds: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
  };
  const toolCalls: ToolCallRecord[] = [];
  // Text emitted alongside tool calls is transition narration ("Sa verific...")
  // that the response contract forbids. We hold it back and emit only the
  // final round's text: the first thing the user reads is the answer itself.
  let heldNarration = "";

  const emit = (text: string): string => {
    if (text && onText) onText(text);
    return text;
  };

  for (let round = 0; round < params.maxToolRounds; round++) {
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      ...(params.temperature !== null ? { temperature: params.temperature } : {}),
      ...(params.effort !== null
        ? {
            thinking: { type: "adaptive" as const },
            output_config: { effort: params.effort },
          }
        : {}),
      // cache_control on the system block caches tools + system prompt
      // (~65k tokens, identical across turns and rounds): cache reads bill
      // at 10% of input price.
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: COSTI_TOOLS,
      messages: currentMessages,
    });

    usage.rounds += 1;
    usage.inputTokens += response.usage.input_tokens;
    usage.outputTokens += response.usage.output_tokens;
    usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;
    usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;

    const hasToolUse = response.content.some((b) => b.type === "tool_use");
    const roundText = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .filter(Boolean)
      .join("\n\n");

    if (!hasToolUse) {
      const finalText = roundText || heldNarration || EMPTY_ANSWER_MESSAGE;
      return {
        text: emit(finalText),
        toolCalls,
        usage,
        heldNarration,
        params,
        stopReason: response.stop_reason,
      };
    }

    if (roundText) heldNarration = roundText;

    const toolResults: ContentBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, unknown>;
      const toolStart = Date.now();
      const result = await handleToolCall(userId, block.name, input);
      options.onToolCall?.(block.name, Date.now() - toolStart);
      toolCalls.push({ round, name: block.name, input, result });
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

  const fallback = heldNarration || ROUNDS_EXHAUSTED_MESSAGE;
  return {
    text: emit(fallback),
    toolCalls,
    usage,
    heldNarration,
    params,
    stopReason: "max_tool_rounds",
  };
}
