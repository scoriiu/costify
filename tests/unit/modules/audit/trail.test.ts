import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const queryAuditTrailMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/audit/service", () => ({
  queryAuditTrail: queryAuditTrailMock,
}));

import {
  listAccountantAuditTrail,
  listOwnerAuditTrail,
} from "@/modules/audit/trail";
import type { AuditRecord } from "@/modules/audit/types";

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: "evt-1",
    tenantId: "client-1",
    actorId: "user-1",
    actorType: "user",
    pipelineStage: "admin",
    action: "create",
    entityType: "published_period",
    entityId: "pp-1",
    before: null,
    after: { year: 2026, month: 4 },
    metadata: {},
    checksum: "x",
    createdAt: new Date("2026-04-18T10:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  prismaMock.user.findMany.mockReset();
  queryAuditTrailMock.mockReset();
});

describe("listAccountantAuditTrail", () => {
  it("scopes the underlying query by tenantId (clientId)", async () => {
    queryAuditTrailMock.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    await listAccountantAuditTrail("client-A", { limit: 20 });
    expect(queryAuditTrailMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "client-A", limit: 20 })
    );
  });

  it("enriches actor names from the User table", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({ actorId: "user-1" }),
      record({ id: "evt-2", actorId: "user-2" }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "Coriiu Solomon", email: "coriiu@x.ro" },
      { id: "user-2", name: "Claudia", email: "claudia@x.ro" },
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].actorName).toBe("Coriiu Solomon");
    expect(rows[1].actorName).toBe("Claudia");
  });

  it("falls back to 'Sistem' when actor cannot be resolved", async () => {
    queryAuditTrailMock.mockResolvedValue([record({ actorId: "ghost" })]);
    prismaMock.user.findMany.mockResolvedValue([]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].actorName).toBe("Sistem");
  });

  it("translates published_period create into 'a publicat <month>'", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({ entityType: "published_period", action: "create", after: { year: 2026, month: 4 } }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "Coriiu", email: "c@x.ro" },
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].description).toContain("a publicat aprilie 2026");
  });

  it("translates published_period update into 'a re-publicat <month>'", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({ entityType: "published_period", action: "update", after: { year: 2026, month: 3 } }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "Coriiu", email: "c@x.ro" },
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].description).toContain("a re-publicat martie 2026");
  });

  it("translates published_period delete into 'a retras publicarea'", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({
        entityType: "published_period",
        action: "delete",
        after: null,
        before: { year: 2026, month: 3 },
      }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "Coriiu", email: "c@x.ro" },
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].description).toContain("a retras publicarea pentru martie 2026");
  });
});

describe("listOwnerAuditTrail", () => {
  it("filters out internal noise (firma_dashboard views, tax_regime_transition etc)", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({ id: "1", entityType: "firma_dashboard", action: "view" }),
      record({ id: "2", entityType: "tax_regime_transition", action: "create" }),
      record({
        id: "3",
        entityType: "published_period",
        action: "create",
        after: { year: 2026, month: 4 },
      }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "Coriiu", email: "c@x.ro" },
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("3");
  });

  it("translates to OWNER-friendly Romanian without OMFP jargon", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({
        entityType: "published_period",
        action: "create",
        after: { year: 2026, month: 4 },
      }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "Coriiu Solomon", email: "c@x.ro" },
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows[0].description).toContain("Coriiu Solomon");
    expect(rows[0].description).toContain("publicat aprilie 2026");
    // no OMFP-style words
    expect(rows[0].description).not.toMatch(/regim|cont \d|debit|credit/i);
  });

  it("uses 'Contabilul tau' as fallback when actor is unknown", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({
        actorId: "ghost",
        entityType: "import_event",
        action: "create",
        after: { entriesAdded: 100 },
      }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows[0].description).toContain("Contabilul tau");
  });

  it("scopes by tenantId and does not leak across clients", async () => {
    queryAuditTrailMock.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    await listOwnerAuditTrail("client-A");
    expect(queryAuditTrailMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "client-A" })
    );
  });

  it("never includes account-numbered entity types (client_account etc.)", async () => {
    queryAuditTrailMock.mockResolvedValue([
      record({ id: "1", entityType: "client_account", metadata: { code: "401" } }),
      record({ id: "2", entityType: "client_account_review" }),
      record({ id: "3", entityType: "tax_regime_legacy" }),
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1", name: "X", email: "x@x.ro" },
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows).toHaveLength(0);
  });
});
