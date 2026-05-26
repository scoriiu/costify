/**
 * Convenience wrapper for the most common audit pattern in the app:
 * "an ACCOUNTANT just mutated something on one of their clients."
 *
 * Reduces a 12-line recordAuditEvent boilerplate to a 3-line call at every
 * action site, which is the only way coverage stays at 100% as the app grows.
 *
 * Use this for client-scoped mutations (settings, tax regime, accounts).
 * For pipeline-stage events (ingest, journal, balance recalc) keep using
 * recordAuditEvent directly — they need specific pipelineStage values.
 */

import { recordAuditEvent } from "./service";
import type { AuditAction } from "./types";

interface ClientMutationInput {
  /** Tenant scope = the Client this mutation belongs to. */
  clientId: string;
  /** The acting user (always a real session user for these calls). */
  actorId: string;
  /** Verb (create/update/delete/etc). */
  action: AuditAction;
  /** Domain entity affected, in snake_case ("tax_regime", "client_info", "client_account"). */
  entityType: string;
  /** Stable ID of the entity inside the tenant. Use the clientId when there's
   *  no separate row (e.g. mutating Client.name). */
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Optional extra context for the audit log row (slug, IP, etc). */
  metadata?: Record<string, unknown>;
}

export async function recordClientMutation(input: ClientMutationInput): Promise<void> {
  await recordAuditEvent({
    tenantId: input.clientId,
    actorId: input.actorId,
    actorType: "user",
    pipelineStage: "admin",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    metadata: input.metadata ?? {},
  });
}
