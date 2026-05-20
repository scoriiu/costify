"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/modules/auth/session";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/modules/audit";
import { parseUserRole } from "./types";
import {
  grantClientAccess as grantSvc,
  revokeClientAccess as revokeSvc,
} from "./client-access.service";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertAccountantOwnsClient(clientId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Neautentificat");
  if (parseUserRole(user.userRole) !== "ACCOUNTANT") {
    throw new Error("Doar contabilii pot gestiona accesul clientilor");
  }
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id, active: true },
    select: { id: true, slug: true, name: true },
  });
  if (!client) throw new Error("Clientul nu exista sau nu apartine contului tau");
  return { user, client };
}

interface GrantInput {
  clientId: string;
  ownerEmail: string;
  ownerName: string;
}

export async function grantClientAccessAction(
  input: GrantInput
): Promise<ActionResult<{ isNewUser: boolean; temporaryPassword: string | null; userEmail: string }>> {
  try {
    const { user, client } = await assertAccountantOwnsClient(input.clientId);

    const result = await grantSvc({
      clientId: input.clientId,
      ownerEmail: input.ownerEmail,
      ownerName: input.ownerName,
      grantedBy: user.id,
    });

    await recordAuditEvent({
      tenantId: client.id,
      actorId: user.id,
      actorType: "user",
      pipelineStage: "admin",
      action: "grant",
      entityType: "client_access",
      entityId: result.access.id,
      before: null,
      after: {
        userId: result.access.userId,
        userEmail: result.access.userEmail,
        role: result.access.role,
      },
      metadata: {
        clientSlug: client.slug,
        clientName: client.name,
        isNewUser: result.isNewUser,
      },
    });

    revalidatePath(`/clients/${client.slug}`);
    return {
      ok: true,
      data: {
        isNewUser: result.isNewUser,
        temporaryPassword: result.temporaryPassword,
        userEmail: result.access.userEmail,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Eroare la adaugare acces";
    return { ok: false, error: msg };
  }
}

interface RevokeInput {
  clientId: string;
  userId: string;
}

export async function revokeClientAccessAction(
  input: RevokeInput
): Promise<ActionResult> {
  try {
    const { user, client } = await assertAccountantOwnsClient(input.clientId);

    const access = await prisma.clientAccess.findUnique({
      where: { userId_clientId: { userId: input.userId, clientId: input.clientId } },
      include: { user: true },
    });
    if (!access) return { ok: false, error: "Accesul nu a fost gasit" };

    await revokeSvc({ clientId: input.clientId, userId: input.userId });

    await recordAuditEvent({
      tenantId: client.id,
      actorId: user.id,
      actorType: "user",
      pipelineStage: "admin",
      action: "revoke",
      entityType: "client_access",
      entityId: access.id,
      before: {
        userId: access.user.id,
        userEmail: access.user.email,
        role: access.role,
      },
      after: null,
      metadata: {
        clientSlug: client.slug,
        clientName: client.name,
      },
    });

    revalidatePath(`/clients/${client.slug}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Eroare la revocare acces";
    return { ok: false, error: msg };
  }
}
