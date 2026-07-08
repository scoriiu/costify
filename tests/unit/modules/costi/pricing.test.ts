import { describe, it, expect } from "vitest";
import { priceForModel, computeCostUsd } from "@/modules/costi/pricing";

const NO_CACHE = { cacheWriteTokens: 0, cacheReadTokens: 0 };

describe("priceForModel", () => {
  it("matches dated snapshots by prefix", () => {
    expect(priceForModel("claude-haiku-4-5-20251001")).toEqual({ input: 1, output: 5 });
    expect(priceForModel("claude-sonnet-4-5-20250929")).toEqual({ input: 3, output: 15 });
  });

  it("prices sonnet-5 at the sonnet tier and opus at the opus tier", () => {
    expect(priceForModel("claude-sonnet-5")).toEqual({ input: 3, output: 15 });
    expect(priceForModel("claude-opus-4-8")).toEqual({ input: 5, output: 25 });
  });

  it("falls back to the sonnet tier for unknown models", () => {
    expect(priceForModel("claude-next-99")).toEqual({ input: 3, output: 15 });
  });
});

describe("computeCostUsd", () => {
  it("computes plain input/output cost", () => {
    // 1M in at $3 + 100k out at $15 = 3 + 1.5
    expect(
      computeCostUsd("claude-sonnet-5", {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        ...NO_CACHE,
      })
    ).toBe(4.5);
  });

  it("bills cache writes at 1.25x and reads at 0.1x input price", () => {
    expect(
      computeCostUsd("claude-sonnet-5", {
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
      })
    ).toBe(3.75 + 0.3);
  });

  it("rounds to 6 decimals for small conversations", () => {
    const cost = computeCostUsd("claude-sonnet-5", {
      inputTokens: 1_500,
      outputTokens: 800,
      cacheWriteTokens: 0,
      cacheReadTokens: 30_000,
    });
    // 1500*3/1M + 800*15/1M + 30000*0.3/1M = 0.0045 + 0.012 + 0.009
    expect(cost).toBe(0.0255);
  });
});
