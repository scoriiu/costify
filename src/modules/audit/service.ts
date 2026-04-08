import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { computeAuditChecksum } from "./checksum";
import type { AuditEvent, AuditQuery, AuditRecord } from "./types";
import type { PipelineStage, ActorType } from "@/shared/types";

const MAX_QUERY_LIMIT = 100;

export async function recordAuditEvent(event: AuditEvent): Promise<AuditRecord> {
  const checksum = computeAuditChecksum(event);

  const record = await prisma.auditEvent.create({
    data: {
      tenantId: event.tenantId,
      actorId: event.actorId,
      actorType: event.actorType,
      pipelineStage: event.pipelineStage,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: (event.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (event.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      metadata: event.metadata as Prisma.InputJsonValue,
      checksum,
    },
  });

  return toAuditRecord(record);
}

export async function queryAuditTrail(query: AuditQuery): Promise<AuditRecord[]> {
  const limit = Math.min(query.limit ?? 50, MAX_QUERY_LIMIT);
  const offset = query.offset ?? 0;

  const where: Record<string, unknown> = { tenantId: query.tenantId };
  if (query.entityType) where.entityType = query.entityType;
  if (query.entityId) where.entityId = query.entityId;
  if (query.pipelineStage) where.pipelineStage = query.pipelineStage;
  if (query.actorId) where.actorId = query.actorId;

  if (query.startDate || query.endDate) {
    const createdAt: Record<string, Date> = {};
    if (query.startDate) createdAt.gte = query.startDate;
    if (query.endDate) createdAt.lte = query.endDate;
    where.createdAt = createdAt;
  }

  const records = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return records.map(toAuditRecord);
}

export async function getEntityAuditTrail(
  tenantId: string,
  entityType: string,
  entityId: string
): Promise<AuditRecord[]> {
  return queryAuditTrail({ tenantId, entityType, entityId, limit: MAX_QUERY_LIMIT });
}

function toAuditRecord(record: {
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
}): AuditRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    actorId: record.actorId,
    actorType: record.actorType as ActorType,
    pipelineStage: record.pipelineStage as PipelineStage,
    action: record.action as AuditRecord["action"],
    entityType: record.entityType,
    entityId: record.entityId,
    before: (record.before as Record<string, unknown>) ?? null,
    after: (record.after as Record<string, unknown>) ?? null,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    checksum: record.checksum,
    createdAt: record.createdAt,
  };
}
