/**
 * Records an audit event when a user opens a /firma page.
 *
 * Goal: track ACCOUNTANT previews of a client's owner view (compliance + trust).
 *       OWNER access to their own data is not logged here (would be noisy and
 *       offers no audit value; OWNER-driven mutations will be logged at the
 *       action site, not here).
 */

import { headers } from "next/headers";
import { recordAuditEvent } from "@/modules/audit";
import type { ResolvedSessionUser, ResolvedClient } from "./resolve-client";

interface RecordOpts {
  user: ResolvedSessionUser;
  client: ResolvedClient;
  page: string;
  viaAccountantPreview: boolean;
}

export async function recordFirmaAccessAudit(opts: RecordOpts): Promise<void> {
  if (!opts.viaAccountantPreview) return;

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent") ?? null;

  try {
    await recordAuditEvent({
      tenantId: opts.client.id,
      actorId: opts.user.id,
      actorType: "user",
      pipelineStage: "admin",
      action: "view",
      entityType: "firma_dashboard",
      entityId: opts.client.id,
      before: null,
      after: null,
      metadata: {
        page: opts.page,
        actorEmail: opts.user.email,
        actorRole: opts.user.userRole,
        clientSlug: opts.client.slug,
        clientName: opts.client.name,
        viewMode: "accountant_preview",
        ip,
        userAgent,
      },
    });
  } catch (err) {
    // Audit failure should never break the user-facing request.
    console.warn("[firma/audit] failed to record access event", err);
  }
}
