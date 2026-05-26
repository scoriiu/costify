import { describe, it, expect, vi, beforeEach } from "vitest";

const recordAuditEventMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/audit/service", () => ({
  recordAuditEvent: recordAuditEventMock,
}));

import { recordClientMutation } from "@/modules/audit/helpers";

beforeEach(() => recordAuditEventMock.mockReset());

describe("recordClientMutation", () => {
  it("delegates to recordAuditEvent with sane defaults (actorType=user, stage=admin)", async () => {
    recordAuditEventMock.mockResolvedValue({});
    await recordClientMutation({
      clientId: "client-1",
      actorId: "user-1",
      action: "update",
      entityType: "client_info",
      entityId: "client-1",
      before: { name: "Old" },
      after: { name: "New" },
    });

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      tenantId: "client-1",
      actorId: "user-1",
      actorType: "user",
      pipelineStage: "admin",
      action: "update",
      entityType: "client_info",
      entityId: "client-1",
      before: { name: "Old" },
      after: { name: "New" },
      metadata: {},
    });
  });

  it("passes through optional metadata", async () => {
    recordAuditEventMock.mockResolvedValue({});
    await recordClientMutation({
      clientId: "client-1",
      actorId: "user-1",
      action: "create",
      entityType: "tax_regime_transition",
      entityId: "tr-1",
      before: null,
      after: { taxRegime: "profit_micro_1" },
      metadata: { source: "ui" },
    });

    const arg = recordAuditEventMock.mock.calls[0][0];
    expect(arg.metadata).toEqual({ source: "ui" });
  });
});
