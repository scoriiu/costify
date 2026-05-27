import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listAccountantAuditTrail,
  listOwnerAuditTrail,
} from "@/modules/audit/trail";

interface RawRow {
  id: string;
  tenantId: string;
  actorId: string;
  actorType: string;
  pipelineStage: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  checksum: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
}

function row(overrides: Partial<RawRow> = {}): RawRow {
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
    actorName: "Coriiu Solomon",
    actorEmail: "coriiu@x.ro",
    ...overrides,
  };
}

/** Extract the tenantId interpolated into the SQL template. The first
 *  parameter passed to $queryRaw is the tagged template values array;
 *  by convention our query interpolates ${clientId} as the second value. */
function lastClientIdArg(): string | undefined {
  const calls = prismaMock.$queryRaw.mock.calls;
  if (calls.length === 0) return undefined;
  const args = calls[calls.length - 1];
  // args = [TemplateStringsArray, ...values]. The first interpolation is clientId.
  return args[1] as string | undefined;
}

beforeEach(() => {
  prismaMock.$queryRaw.mockReset();
});

describe("listAccountantAuditTrail", () => {
  it("scopes the underlying query by tenantId (clientId)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await listAccountantAuditTrail("client-A", { limit: 20 });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(lastClientIdArg()).toBe("client-A");
  });

  it("enriches actor names from the joined User row", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({ actorId: "user-1", actorName: "Coriiu Solomon", actorEmail: "coriiu@x.ro" }),
      row({ id: "evt-2", actorId: "user-2", actorName: "Claudia", actorEmail: "claudia@x.ro" }),
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].actorName).toBe("Coriiu Solomon");
    expect(rows[1].actorName).toBe("Claudia");
  });

  it("falls back to 'Sistem' when actor cannot be resolved (LEFT JOIN miss)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({ actorId: "ghost", actorName: null, actorEmail: null }),
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].actorName).toBe("Sistem");
  });

  it("translates published_period create into 'a publicat <month>'", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({ entityType: "published_period", action: "create", after: { year: 2026, month: 4 } }),
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].description).toContain("a publicat aprilie 2026");
  });

  it("translates published_period update into 'a re-publicat <month>'", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({ entityType: "published_period", action: "update", after: { year: 2026, month: 3 } }),
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].description).toContain("a re-publicat martie 2026");
  });

  it("translates published_period delete into 'a retras publicarea'", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({
        entityType: "published_period",
        action: "delete",
        after: null,
        before: { year: 2026, month: 3 },
      }),
    ]);
    const rows = await listAccountantAuditTrail("client-A");
    expect(rows[0].description).toContain("a retras publicarea pentru martie 2026");
  });
});

describe("listOwnerAuditTrail", () => {
  it("filters out internal noise (firma_dashboard views, tax_regime_transition etc)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({ id: "1", entityType: "firma_dashboard", action: "view" }),
      row({ id: "2", entityType: "tax_regime_transition", action: "create" }),
      row({
        id: "3",
        entityType: "published_period",
        action: "create",
        after: { year: 2026, month: 4 },
      }),
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("3");
  });

  it("translates to OWNER-friendly Romanian without OMFP jargon", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({
        entityType: "published_period",
        action: "create",
        after: { year: 2026, month: 4 },
        actorName: "Coriiu Solomon",
      }),
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows[0].description).toContain("Coriiu Solomon");
    expect(rows[0].description).toContain("publicat aprilie 2026");
    expect(rows[0].description).not.toMatch(/regim|cont \d|debit|credit/i);
  });

  it("uses 'Contabilul tau' as fallback when actor is unknown", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({
        actorId: "ghost",
        actorName: null,
        entityType: "import_event",
        action: "create",
        after: { entriesAdded: 100 },
      }),
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows[0].description).toContain("Contabilul tau");
  });

  it("scopes by tenantId and does not leak across clients", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await listOwnerAuditTrail("client-A");
    expect(lastClientIdArg()).toBe("client-A");
  });

  it("never includes account-numbered entity types (client_account etc.)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      row({ id: "1", entityType: "client_account", metadata: { code: "401" } }),
      row({ id: "2", entityType: "client_account_review" }),
      row({ id: "3", entityType: "tax_regime_legacy" }),
    ]);
    const rows = await listOwnerAuditTrail("client-A");
    expect(rows).toHaveLength(0);
  });
});
