"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/modules/auth/session";
import { parseUserRole } from "@/modules/roles";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/modules/audit";
import {
  publishPeriod as publishSvc,
  unpublishPeriod as unpublishSvc,
  getPublishedView,
} from "./service";
import { digestSnapshot } from "./snapshot-hash";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function assertAccountantOwnsClient(clientId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Neautentificat");
  if (parseUserRole(user.userRole) !== "ACCOUNTANT") {
    throw new Error("Doar contabilii pot publica luni");
  }
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id, active: true },
    select: { id: true, slug: true, name: true },
  });
  if (!client) throw new Error("Clientul nu exista sau nu apartine contului tau");
  return { user, client };
}

interface PublishInput {
  clientId: string;
  year: number;
  month: number;
  noteForOwner?: string | null;
}

export async function publishPeriodAction(
  input: PublishInput
): Promise<ActionResult<{ publishedAt: string; isRepublish: boolean; snapshotHash: string }>> {
  try {
    const { user, client } = await assertAccountantOwnsClient(input.clientId);

    const previous = await getPublishedView(input.clientId, input.year, input.month);

    const result = await publishSvc({
      clientId: input.clientId,
      year: input.year,
      month: input.month,
      publishedBy: user.id,
      noteForOwner: input.noteForOwner ?? null,
    });

    // Re-fetch the just-published view so we can build a digest without a full
    // recompute. The snapshot was just written in the same transaction.
    const refreshed = await getPublishedView(input.clientId, input.year, input.month);

    await recordAuditEvent({
      tenantId: client.id,
      actorId: user.id,
      actorType: "user",
      pipelineStage: "admin",
      action: previous ? "update" : "create",
      entityType: "published_period",
      entityId: result.id,
      // Store digests, not full snapshots. Keeps audit row small (sub-KB)
      // while still letting us answer "what did the patron see on X date?"
      // via the snapshotHash + reconstructed delta.
      before: previous
        ? {
            year: previous.year,
            month: previous.month,
            publishedAt: previous.publishedAt.toISOString(),
            noteForOwner: previous.noteForOwner,
            digest: digestSnapshot(previous.snapshot, previous.snapshotHash),
          }
        : null,
      after: refreshed
        ? {
            year: refreshed.year,
            month: refreshed.month,
            publishedAt: refreshed.publishedAt.toISOString(),
            noteForOwner: refreshed.noteForOwner,
            digest: digestSnapshot(refreshed.snapshot, refreshed.snapshotHash),
          }
        : null,
      metadata: {
        clientSlug: client.slug,
        clientName: client.name,
        isRepublish: previous !== null,
        action: "publish_period",
      },
    });

    revalidatePath(`/clients/${client.slug}`);
    revalidatePath("/firma");

    return {
      ok: true,
      data: {
        publishedAt: result.publishedAt.toISOString(),
        isRepublish: previous !== null,
        snapshotHash: result.snapshotHash,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Eroare la publicare";
    return { ok: false, error: msg };
  }
}

interface UnpublishInput {
  clientId: string;
  year: number;
  month: number;
}

export async function unpublishPeriodAction(input: UnpublishInput): Promise<ActionResult> {
  try {
    const { user, client } = await assertAccountantOwnsClient(input.clientId);

    const previous = await getPublishedView(input.clientId, input.year, input.month);
    if (!previous) return { ok: false, error: "Aceasta luna nu este publicata" };

    await unpublishSvc({ clientId: input.clientId, year: input.year, month: input.month });

    await recordAuditEvent({
      tenantId: client.id,
      actorId: user.id,
      actorType: "user",
      pipelineStage: "admin",
      action: "delete",
      entityType: "published_period",
      entityId: previous.id,
      before: {
        year: previous.year,
        month: previous.month,
        publishedAt: previous.publishedAt.toISOString(),
        noteForOwner: previous.noteForOwner,
        digest: digestSnapshot(previous.snapshot, previous.snapshotHash),
      },
      after: null,
      metadata: {
        clientSlug: client.slug,
        clientName: client.name,
        action: "unpublish_period",
      },
    });

    revalidatePath(`/clients/${client.slug}`);
    revalidatePath("/firma");

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Eroare la retragerea publicarii";
    return { ok: false, error: msg };
  }
}
