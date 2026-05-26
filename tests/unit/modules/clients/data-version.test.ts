import { describe, it, expect, vi } from "vitest";
import {
  bumpClientDataVersion,
  clientDataVersionTag,
} from "@/modules/clients/data-version";
import type { PrismaClient } from "@prisma/client";

/** Builds a minimal mock of the `client` model surface that bumpClientDataVersion
 *  touches. The fake state lets us assert "two bumps produce strictly increasing
 *  versions" without standing up a database. */
function makePrismaMock(initial = 0) {
  const state = { dataVersion: initial };
  const update = vi.fn(async () => {
    state.dataVersion += 1;
    return { dataVersion: state.dataVersion };
  });
  const mock = {
    client: { update },
  } as unknown as Pick<PrismaClient, "client">;
  return { mock, update, state };
}

describe("clientDataVersionTag", () => {
  it("produces a stable, unique tag per clientId", () => {
    expect(clientDataVersionTag("abc")).toBe("client:abc:data");
    expect(clientDataVersionTag("xyz")).toBe("client:xyz:data");
    expect(clientDataVersionTag("abc")).not.toBe(clientDataVersionTag("xyz"));
  });

  it("does not collide when one id is a prefix of another", () => {
    const a = clientDataVersionTag("ab");
    const b = clientDataVersionTag("abc");
    expect(a).not.toBe(b);
  });
});

describe("bumpClientDataVersion", () => {
  it("issues exactly one UPDATE per call and returns the new version", async () => {
    const { mock, update, state } = makePrismaMock(7);

    const v = await bumpClientDataVersion("client-1", mock);

    expect(update).toHaveBeenCalledTimes(1);
    expect(v).toBe(8);
    expect(state.dataVersion).toBe(8);
  });

  it("uses Prisma's atomic { increment: 1 } operator (not read-modify-write)", async () => {
    const { mock, update } = makePrismaMock();

    await bumpClientDataVersion("client-1", mock);

    const args = update.mock.calls[0] as unknown[] | undefined;
    const call = args?.[0] as
      | { where: { id: string }; data: { dataVersion: { increment: number } } }
      | undefined;
    expect(call?.where.id).toBe("client-1");
    expect(call?.data.dataVersion).toEqual({ increment: 1 });
  });

  it("monotonic under sequential calls", async () => {
    const { mock } = makePrismaMock(0);

    const v1 = await bumpClientDataVersion("client-1", mock);
    const v2 = await bumpClientDataVersion("client-1", mock);
    const v3 = await bumpClientDataVersion("client-1", mock);

    expect(v1).toBe(1);
    expect(v2).toBe(2);
    expect(v3).toBe(3);
  });

  it("monotonic under concurrent calls (mock simulates DB-side serialization)", async () => {
    const { mock } = makePrismaMock(0);

    const versions = await Promise.all(
      Array.from({ length: 10 }, () => bumpClientDataVersion("client-1", mock))
    );

    // Mock isn't truly concurrent — but the contract is "each call returns a
    // strictly larger version than any previous call". The set of values must
    // be {1..10}.
    expect(new Set(versions)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });
});
