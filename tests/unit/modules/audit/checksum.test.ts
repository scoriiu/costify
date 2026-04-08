import { describe, it, expect } from "vitest";
import { computeAuditChecksum, verifyAuditChecksum } from "@/modules/audit/checksum";
import type { AuditEvent } from "@/modules/audit/types";

function makeEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    tenantId: "tenant-1",
    actorId: "user-1",
    actorType: "user",
    pipelineStage: "ingest",
    action: "create",
    entityType: "dataset",
    entityId: "dataset-1",
    before: null,
    after: { name: "test" },
    metadata: {},
    ...overrides,
  };
}

describe("computeAuditChecksum", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const checksum = computeAuditChecksum(makeEvent());
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces deterministic output for same input", () => {
    const event = makeEvent();
    const a = computeAuditChecksum(event);
    const b = computeAuditChecksum(event);
    expect(a).toBe(b);
  });

  it("produces different checksums for different events", () => {
    const a = computeAuditChecksum(makeEvent({ entityId: "aaa" }));
    const b = computeAuditChecksum(makeEvent({ entityId: "bbb" }));
    expect(a).not.toBe(b);
  });

  it("changes when before/after data changes", () => {
    const a = computeAuditChecksum(makeEvent({ after: { name: "v1" } }));
    const b = computeAuditChecksum(makeEvent({ after: { name: "v2" } }));
    expect(a).not.toBe(b);
  });

  it("changes when metadata changes", () => {
    const a = computeAuditChecksum(makeEvent({ metadata: { ip: "1.1.1.1" } }));
    const b = computeAuditChecksum(makeEvent({ metadata: { ip: "2.2.2.2" } }));
    expect(a).not.toBe(b);
  });

  it("changes when actor changes", () => {
    const a = computeAuditChecksum(makeEvent({ actorId: "user-1" }));
    const b = computeAuditChecksum(makeEvent({ actorId: "user-2" }));
    expect(a).not.toBe(b);
  });
});

describe("verifyAuditChecksum", () => {
  it("returns true for matching checksum", () => {
    const event = makeEvent();
    const checksum = computeAuditChecksum(event);
    expect(verifyAuditChecksum(event, checksum)).toBe(true);
  });

  it("returns false for tampered data", () => {
    const event = makeEvent();
    const checksum = computeAuditChecksum(event);
    const tampered = { ...event, entityId: "hacked" };
    expect(verifyAuditChecksum(tampered, checksum)).toBe(false);
  });

  it("returns false for wrong checksum", () => {
    const event = makeEvent();
    expect(verifyAuditChecksum(event, "0".repeat(64))).toBe(false);
  });
});
