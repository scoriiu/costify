import { createHash } from "crypto";
import type { AuditEvent } from "./types";

export function computeAuditChecksum(event: AuditEvent): string {
  const payload = JSON.stringify({
    tenantId: event.tenantId,
    actorId: event.actorId,
    actorType: event.actorType,
    pipelineStage: event.pipelineStage,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: event.before,
    after: event.after,
    metadata: event.metadata,
  });

  return createHash("sha256").update(payload).digest("hex");
}

export function verifyAuditChecksum(
  event: AuditEvent,
  storedChecksum: string
): boolean {
  return computeAuditChecksum(event) === storedChecksum;
}
