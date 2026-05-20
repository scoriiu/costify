import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
const listClientsForOwnerMock = vi.hoisted(() => vi.fn());
const prismaClientFindFirstMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/session", () => ({
  getSessionUser: getSessionUserMock,
}));

vi.mock("@/modules/roles", () => ({
  listClientsForOwner: listClientsForOwnerMock,
  parseUserRole: (v: unknown) => (v === "OWNER" ? "OWNER" : "ACCOUNTANT"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    client: { findFirst: prismaClientFindFirstMock },
  },
}));

import { resolveFirmaContext } from "@/app/(firma)/firma/_lib/resolve-client";

beforeEach(() => {
  getSessionUserMock.mockReset();
  listClientsForOwnerMock.mockReset();
  prismaClientFindFirstMock.mockReset();
});

function sessionUser(overrides?: Partial<{ id: string; email: string; name: string; userRole: string }>) {
  return {
    id: "user-1",
    email: "test@costify.ro",
    name: "Test User",
    userRole: "ACCOUNTANT",
    ...overrides,
  };
}

describe("resolveFirmaContext — anonymous", () => {
  it("redirects to /login when there is no session", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const result = await resolveFirmaContext();
    expect(result).toEqual({ kind: "redirect", to: "/login" });
  });
});

describe("resolveFirmaContext — OWNER role", () => {
  it("returns 'no-access' when the OWNER has zero client accesses", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "OWNER" }));
    listClientsForOwnerMock.mockResolvedValue([]);

    const result = await resolveFirmaContext();
    expect(result.kind).toBe("no-access");
    if (result.kind === "no-access") {
      expect(result.user.userRole).toBe("OWNER");
    }
  });

  it("returns 'ok' with the only client when the OWNER has exactly one access", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "OWNER" }));
    listClientsForOwnerMock.mockResolvedValue([
      {
        clientId: "c1",
        clientName: "QHM21",
        clientSlug: "qhm21",
        clientCui: "RO1",
        grantedAt: new Date(),
      },
    ]);

    const result = await resolveFirmaContext();
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.client.id).toBe("c1");
      expect(result.client.slug).toBe("qhm21");
      expect(result.viaAccountantPreview).toBe(false);
    }
  });

  it("returns 'selector' when the OWNER has multiple accesses and no firmSlug picked", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "OWNER" }));
    listClientsForOwnerMock.mockResolvedValue([
      { clientId: "c1", clientName: "A", clientSlug: "a", clientCui: null, grantedAt: new Date() },
      { clientId: "c2", clientName: "B", clientSlug: "b", clientCui: null, grantedAt: new Date() },
    ]);

    const result = await resolveFirmaContext();
    expect(result.kind).toBe("selector");
    if (result.kind === "selector") {
      expect(result.clients).toHaveLength(2);
    }
  });

  it("returns 'ok' for the picked firmSlug when the OWNER has multiple accesses", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "OWNER" }));
    listClientsForOwnerMock.mockResolvedValue([
      { clientId: "c1", clientName: "A", clientSlug: "a", clientCui: null, grantedAt: new Date() },
      { clientId: "c2", clientName: "B", clientSlug: "b", clientCui: null, grantedAt: new Date() },
    ]);

    const result = await resolveFirmaContext({ firmSlug: "b" });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.client.slug).toBe("b");
    }
  });

  it("falls back to selector when firmSlug points to a client the OWNER doesn't have", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "OWNER" }));
    listClientsForOwnerMock.mockResolvedValue([
      { clientId: "c1", clientName: "A", clientSlug: "a", clientCui: null, grantedAt: new Date() },
      { clientId: "c2", clientName: "B", clientSlug: "b", clientCui: null, grantedAt: new Date() },
    ]);

    const result = await resolveFirmaContext({ firmSlug: "nonexistent" });
    expect(result.kind).toBe("selector");
  });

  it("ignores ?as= for OWNER users", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "OWNER" }));
    listClientsForOwnerMock.mockResolvedValue([
      { clientId: "c1", clientName: "A", clientSlug: "a", clientCui: null, grantedAt: new Date() },
    ]);

    const result = await resolveFirmaContext({ asClientId: "different-client" });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.client.id).toBe("c1");
    }
  });
});

describe("resolveFirmaContext — ACCOUNTANT role", () => {
  it("redirects to /clients when no ?as= is provided", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "ACCOUNTANT" }));

    const result = await resolveFirmaContext();
    expect(result).toEqual({ kind: "redirect", to: "/clients" });
  });

  it("returns 'ok' with the matching client when ?as= belongs to the ACCOUNTANT", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "ACCOUNTANT" }));
    prismaClientFindFirstMock.mockResolvedValue({
      id: "c1",
      slug: "qhm21",
      name: "QHM21",
      cui: "RO1",
    });

    const result = await resolveFirmaContext({ asClientId: "c1" });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.client.id).toBe("c1");
      expect(result.viaAccountantPreview).toBe(true);
    }
  });

  it("redirects to /clients when ?as= points to a client not owned by the ACCOUNTANT", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "ACCOUNTANT" }));
    prismaClientFindFirstMock.mockResolvedValue(null);

    const result = await resolveFirmaContext({ asClientId: "stranger-client" });
    expect(result).toEqual({ kind: "redirect", to: "/clients" });
  });

  it("ignores firmSlug for ACCOUNTANT users", async () => {
    getSessionUserMock.mockResolvedValue(sessionUser({ userRole: "ACCOUNTANT" }));

    const result = await resolveFirmaContext({ firmSlug: "any-slug" });
    expect(result).toEqual({ kind: "redirect", to: "/clients" });
  });
});
