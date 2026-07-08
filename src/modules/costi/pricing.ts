/**
 * Anthropic API pricing (USD per million tokens) for cost accounting on
 * ChatUsage rows. Verify against https://anthropic.com/pricing when adding
 * a model; prefix matching covers dated snapshots (claude-sonnet-4-5-20250929).
 *
 * Cache pricing is derived per Anthropic docs: writes cost 1.25x input,
 * reads cost 0.1x input.
 */

export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

const PRICES: [prefix: string, price: ModelPrice][] = [
  ["claude-haiku-4-5", { input: 1, output: 5 }],
  ["claude-sonnet-5", { input: 3, output: 15 }],
  ["claude-sonnet-4", { input: 3, output: 15 }],
  ["claude-opus-4", { input: 5, output: 25 }],
];

/** Unknown models bill at the Sonnet tier until the table is updated. */
const FALLBACK: ModelPrice = { input: 3, output: 15 };

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;
const MTOK = 1_000_000;

export function priceForModel(model: string): ModelPrice {
  for (const [prefix, price] of PRICES) {
    if (model.startsWith(prefix)) return price;
  }
  return FALLBACK;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export function computeCostUsd(model: string, usage: UsageTotals): number {
  const p = priceForModel(model);
  const cost =
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheWriteTokens * p.input * CACHE_WRITE_MULTIPLIER +
      usage.cacheReadTokens * p.input * CACHE_READ_MULTIPLIER) /
    MTOK;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
