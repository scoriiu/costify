import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the @/lib/db module so service code doesn't touch a real database.
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  clientAccess: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/modules/auth/password", () => ({
  hashPassword: vi.fn(async (pw: string) => `hash(${pw})`),
}));

import {
  grantClientAccess,
  revokeClientAccess,
  listAccessesForClient,
  listClientsForOwner,
  hasClientAccess,
} from "@/modules/roles/client-access.service";

beforeEach(() => {
  Object.values(prismaMock.user).forEach((fn) => fn.mockReset());
  Object.values(prismaMock.clientAccess).forEach((fn) => fn.mockReset());
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock)
  );
});

describe("grantClientAccess", () => {
  it("creates a new OWNER user when email is unknown, returns temporary password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-new",
      email: "sorin@firma.ro",
      name: "Sorin",
      userRole: "OWNER",
    });
    prismaMock.clientAccess.findUnique.mockResolvedValue(null);
    prismaMock.clientAccess.create.mockResolvedValue({
      id: "access-1",
      userId: "user-new",
      clientId: "client-1",
      role: "OWNER",
      createdBy: "acc-1",
      createdAt: new Date("2026-05-20"),
    });

    const result = await grantClientAccess({
      clientId: "client-1",
      ownerEmail: "sorin@firma.ro",
      ownerName: "Sorin",
      grantedBy: "acc-1",
    });

    expect(result.isNewUser).toBe(true);
    expect(result.temporaryPassword).toBeTypeOf("string");
    expect(result.temporaryPassword!.length).toBeGreaterThanOrEqual(8);
    expect(result.access.userEmail).toBe("sorin@firma.ro");
    expect(result.access.userRole).toBe("OWNER");
    expect(prismaMock.user.create).toHaveBeenCalledOnce();
    expect(prismaMock.clientAccess.create).toHaveBeenCalledOnce();
  });

  it("reuses an existing OWNER user without returning a temporary password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-existing",
      email: "sorin@firma.ro",
      name: "Sorin",
      userRole: "OWNER",
    });
    prismaMock.clientAccess.findUnique.mockResolvedValue(null);
    prismaMock.clientAccess.create.mockResolvedValue({
      id: "access-2",
      userId: "user-existing",
      clientId: "client-1",
      role: "OWNER",
      createdBy: "acc-1",
      createdAt: new Date(),
    });

    const result = await grantClientAccess({
      clientId: "client-1",
      ownerEmail: "Sorin@Firma.RO",
      ownerName: "Sorin",
      grantedBy: "acc-1",
    });

    expect(result.isNewUser).toBe(false);
    expect(result.temporaryPassword).toBeNull();
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: "sorin@firma.ro" } });
  });

  it("refuses to grant access if the email belongs to an ACCOUNTANT", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-acc",
      email: "contabil@cabinet.ro",
      name: "Contabilu",
      userRole: "ACCOUNTANT",
    });

    await expect(
      grantClientAccess({
        clientId: "client-1",
        ownerEmail: "contabil@cabinet.ro",
        ownerName: "Contabilu",
        grantedBy: "acc-1",
      })
    ).rejects.toThrow(/contabil/i);
  });

  it("returns existing access when one already exists for this (user, client) pair", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-existing",
      email: "sorin@firma.ro",
      name: "Sorin",
      userRole: "OWNER",
    });
    prismaMock.clientAccess.findUnique.mockResolvedValue({
      id: "access-existing",
      userId: "user-existing",
      clientId: "client-1",
      role: "OWNER",
      createdBy: "acc-1",
      createdAt: new Date("2026-01-01"),
    });

    const result = await grantClientAccess({
      clientId: "client-1",
      ownerEmail: "sorin@firma.ro",
      ownerName: "Sorin",
      grantedBy: "acc-1",
    });

    expect(result.access.id).toBe("access-existing");
    expect(prismaMock.clientAccess.create).not.toHaveBeenCalled();
  });

  it("rejects invalid emails", async () => {
    await expect(
      grantClientAccess({
        clientId: "client-1",
        ownerEmail: "nope",
        ownerName: "X",
        grantedBy: "acc-1",
      })
    ).rejects.toThrow(/email/i);
  });
});

describe("revokeClientAccess", () => {
  it("returns true when a row was deleted", async () => {
    prismaMock.clientAccess.deleteMany.mockResolvedValue({ count: 1 });
    const result = await revokeClientAccess({ clientId: "client-1", userId: "user-1" });
    expect(result).toBe(true);
    expect(prismaMock.clientAccess.deleteMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", userId: "user-1" },
    });
  });

  it("returns false when no row matched", async () => {
    prismaMock.clientAccess.deleteMany.mockResolvedValue({ count: 0 });
    const result = await revokeClientAccess({ clientId: "client-1", userId: "user-1" });
    expect(result).toBe(false);
  });
});

describe("listAccessesForClient", () => {
  it("maps prisma rows to ClientAccessSummary", async () => {
    prismaMock.clientAccess.findMany.mockResolvedValue([
      {
        id: "a1",
        clientId: "c1",
        role: "OWNER",
        createdAt: new Date("2026-05-20"),
        createdBy: "acc-1",
        user: { id: "u1", email: "sorin@firma.ro", name: "Sorin", userRole: "OWNER" },
      },
    ]);

    const result = await listAccessesForClient("c1");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "a1",
      userId: "u1",
      userEmail: "sorin@firma.ro",
      userName: "Sorin",
      userRole: "OWNER",
      clientId: "c1",
      role: "OWNER",
    });
  });

  it("returns empty array when no accesses exist", async () => {
    prismaMock.clientAccess.findMany.mockResolvedValue([]);
    expect(await listAccessesForClient("c1")).toEqual([]);
  });
});

describe("listClientsForOwner", () => {
  it("maps prisma rows to OwnerClientSummary, alphabetical by client name", async () => {
    prismaMock.clientAccess.findMany.mockResolvedValue([
      {
        clientId: "c1",
        createdAt: new Date("2026-01-01"),
        client: { id: "c1", name: "Alpha SRL", slug: "alpha-srl", cui: "RO1" },
      },
      {
        clientId: "c2",
        createdAt: new Date("2026-02-01"),
        client: { id: "c2", name: "Beta SRL", slug: "beta-srl", cui: null },
      },
    ]);

    const result = await listClientsForOwner("user-1");
    expect(result).toHaveLength(2);
    expect(result[0].clientName).toBe("Alpha SRL");
    expect(result[1].clientCui).toBeNull();
  });
});

describe("hasClientAccess", () => {
  it("returns true when the access row exists", async () => {
    prismaMock.clientAccess.findUnique.mockResolvedValue({ id: "a1" });
    expect(await hasClientAccess("u1", "c1")).toBe(true);
  });

  it("returns false when no row matches", async () => {
    prismaMock.clientAccess.findUnique.mockResolvedValue(null);
    expect(await hasClientAccess("u1", "c1")).toBe(false);
  });
});
