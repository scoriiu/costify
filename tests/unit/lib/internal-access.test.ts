import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";

/**
 * `isInternalUser` reads the env var at module evaluation. To test multiple
 * configurations we reset the module registry between tests so each dynamic
 * import re-runs the top-level env read.
 */

const ORIGINAL = process.env.NEXT_PUBLIC_INTERNAL_USER_EMAILS;

async function loadHelper(envValue: string | undefined) {
  vi.resetModules();
  if (envValue === undefined) {
    delete process.env.NEXT_PUBLIC_INTERNAL_USER_EMAILS;
  } else {
    process.env.NEXT_PUBLIC_INTERNAL_USER_EMAILS = envValue;
  }
  const mod = await import("@/lib/internal-access");
  return mod.isInternalUser;
}

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_INTERNAL_USER_EMAILS;
  else process.env.NEXT_PUBLIC_INTERNAL_USER_EMAILS = ORIGINAL;
  vi.resetModules();
});

beforeEach(() => {
  vi.resetModules();
});

describe("isInternalUser", () => {
  it("returns false when env is unset (fail closed)", async () => {
    const isInternal = await loadHelper(undefined);
    expect(isInternal("anyone@costify.ro")).toBe(false);
  });

  it("returns false for null / undefined / empty email", async () => {
    const isInternal = await loadHelper("a@b.com");
    expect(isInternal(null)).toBe(false);
    expect(isInternal(undefined)).toBe(false);
    expect(isInternal("")).toBe(false);
  });

  it("matches a single configured email exactly", async () => {
    const isInternal = await loadHelper("alice@costify.ro");
    expect(isInternal("alice@costify.ro")).toBe(true);
    expect(isInternal("bob@costify.ro")).toBe(false);
  });

  it("matches across a comma-separated list", async () => {
    const isInternal = await loadHelper("alice@x.ro,bob@x.ro,carol@x.ro");
    expect(isInternal("alice@x.ro")).toBe(true);
    expect(isInternal("bob@x.ro")).toBe(true);
    expect(isInternal("carol@x.ro")).toBe(true);
    expect(isInternal("dave@x.ro")).toBe(false);
  });

  it("trims whitespace and ignores empty entries", async () => {
    const isInternal = await loadHelper(" alice@x.ro , , bob@x.ro,  ");
    expect(isInternal("alice@x.ro")).toBe(true);
    expect(isInternal("bob@x.ro")).toBe(true);
  });

  it("is case-insensitive on both sides", async () => {
    const isInternal = await loadHelper("Alice@Costify.RO");
    expect(isInternal("alice@costify.ro")).toBe(true);
    expect(isInternal("ALICE@COSTIFY.RO")).toBe(true);
    expect(isInternal("Alice@Costify.RO")).toBe(true);
  });
});
