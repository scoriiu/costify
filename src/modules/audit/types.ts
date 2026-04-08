import type { PipelineStage, ActorType } from "@/shared/types";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "recalculate"
  | "export"
  | "login"
  | "logout";

export interface AuditEvent {
  tenantId: string;
  actorId: string;
  actorType: ActorType;
  pipelineStage: PipelineStage;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface AuditRecord extends AuditEvent {
  id: string;
  checksum: string;
  createdAt: Date;
}

export interface AuditQuery {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  pipelineStage?: PipelineStage;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
