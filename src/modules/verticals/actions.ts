"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { recordClientMutation } from "@/modules/audit";
import { bumpClientDataVersion } from "@/modules/clients/data-version";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import * as service from "./service";

type ActionResult<T = void> = { error?: string; data?: T };

async function authorize(clientId: string): Promise<{ userId: string } | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id },
    select: { id: true },
  });
  if (!client) return null;
  return { userId: user.id };
}

/**
 * Post-mutation invalidation. Vertical config changes redistribute the
 * cashflow categories that already-mapped accounts and partners fall into,
 * so we MUST bump the data version (invalidates balance/CPP/mapari/owner
 * snapshot caches) in addition to revalidating Next's path cache.
 */
async function bumpAndRevalidate(clientId: string): Promise<void> {
  await bumpClientDataVersion(clientId);
  revalidatePath("/clients");
}

const enableSchema = z.object({ clientId: z.string().min(1) });

export async function enableVerticalsAction(
  input: z.infer<typeof enableSchema>
): Promise<ActionResult<{ defaultVerticalId: string }>> {
  const parsed = enableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const result = await service.enableVerticals(prisma, parsed.data.clientId);
  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: auth.userId,
    action: "update",
    entityType: "client_verticals_flag",
    entityId: parsed.data.clientId,
    before: { verticalsEnabled: false },
    after: { verticalsEnabled: true },
  });
  await bumpAndRevalidate(parsed.data.clientId);
  return { data: { defaultVerticalId: result.defaultVerticalId } };
}

export async function disableVerticalsAction(
  input: z.infer<typeof enableSchema>
): Promise<ActionResult> {
  const parsed = enableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  await service.disableVerticals(prisma, parsed.data.clientId);
  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: auth.userId,
    action: "update",
    entityType: "client_verticals_flag",
    entityId: parsed.data.clientId,
    before: { verticalsEnabled: true },
    after: { verticalsEnabled: false },
  });
  await bumpAndRevalidate(parsed.data.clientId);
  return {};
}

const createVerticalSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(60),
});

export async function createVerticalAction(
  input: z.infer<typeof createVerticalSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = createVerticalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const created = await service.createVertical(prisma, {
      clientId: parsed.data.clientId,
      name: parsed.data.name,
    });
    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "create",
      entityType: "vertical",
      entityId: created.id,
      before: null,
      after: { name: created.name },
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return { data: { id: created.id } };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const renameVerticalSchema = z.object({
  clientId: z.string().min(1),
  verticalId: z.string().min(1),
  name: z.string().min(1).max(60),
});

export async function renameVerticalAction(
  input: z.infer<typeof renameVerticalSchema>
): Promise<ActionResult> {
  const parsed = renameVerticalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const before = await prisma.vertical.findFirst({
      where: { id: parsed.data.verticalId, clientId: parsed.data.clientId },
      select: { name: true },
    });
    if (!before) return { error: "Verticala nu exista" };

    const updated = await service.renameVertical(
      prisma,
      parsed.data.clientId,
      parsed.data.verticalId,
      parsed.data.name
    );

    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "update",
      entityType: "vertical",
      entityId: parsed.data.verticalId,
      before: { name: before.name },
      after: { name: updated.name },
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const deleteVerticalSchema = z.object({
  clientId: z.string().min(1),
  verticalId: z.string().min(1),
});

export async function deleteVerticalAction(
  input: z.infer<typeof deleteVerticalSchema>
): Promise<ActionResult> {
  const parsed = deleteVerticalSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const deleted = await service.deleteVertical(
      prisma,
      parsed.data.clientId,
      parsed.data.verticalId
    );
    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "delete",
      entityType: "vertical",
      entityId: parsed.data.verticalId,
      before: { name: deleted.name },
      after: null,
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const setAllocationSchema = z.object({
  clientId: z.string().min(1),
  scope: z.enum(["contBase", "analytic"]),
  cont: z.string().min(1).max(20),
  splits: z
    .array(z.object({ verticalId: z.string().min(1), percent: z.number().int() }))
    .min(1)
    .max(5),
});

export async function setAllocationAction(
  input: z.infer<typeof setAllocationSchema>
): Promise<ActionResult> {
  const parsed = setAllocationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const before = await prisma.verticalAllocation.findFirst({
      where: { clientId: parsed.data.clientId, cont: parsed.data.cont },
      select: { id: true, splits: true, scope: true },
    });
    const result = await service.setAllocation(prisma, parsed.data);
    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: before ? "update" : "create",
      entityType: "vertical_allocation",
      entityId: result.id,
      before: before
        ? { cont: parsed.data.cont, scope: before.scope, splits: before.splits }
        : null,
      after: {
        cont: parsed.data.cont,
        scope: parsed.data.scope,
        splits: parsed.data.splits,
      },
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const clearAllocationSchema = z.object({
  clientId: z.string().min(1),
  cont: z.string().min(1).max(20),
});

export async function clearAllocationAction(
  input: z.infer<typeof clearAllocationSchema>
): Promise<ActionResult> {
  const parsed = clearAllocationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const deleted = await service.clearAllocation(
      prisma,
      parsed.data.clientId,
      parsed.data.cont
    );
    if (!deleted) return {};
    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "delete",
      entityType: "vertical_allocation",
      entityId: deleted.id,
      before: { cont: deleted.cont, scope: deleted.scope, splits: deleted.splits },
      after: null,
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const setCategoryAllocationSchema = z.object({
  clientId: z.string().min(1),
  categoryId: z.string().min(1),
  splits: z
    .array(z.object({ verticalId: z.string().min(1), percent: z.number().int() }))
    .min(1)
    .max(5),
});

export async function setCategoryAllocationAction(
  input: z.infer<typeof setCategoryAllocationSchema>
): Promise<ActionResult> {
  const parsed = setCategoryAllocationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const before = await prisma.categoryVerticalAllocation.findFirst({
      where: {
        clientId: parsed.data.clientId,
        categoryId: parsed.data.categoryId,
      },
      select: { id: true, splits: true },
    });
    const result = await service.setCategoryAllocation(prisma, parsed.data);
    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: before ? "update" : "create",
      entityType: "category_vertical_allocation",
      entityId: result.id,
      before: before
        ? { categoryId: parsed.data.categoryId, splits: before.splits }
        : null,
      after: { categoryId: parsed.data.categoryId, splits: parsed.data.splits },
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const clearCategoryAllocationSchema = z.object({
  clientId: z.string().min(1),
  categoryId: z.string().min(1),
});

export async function clearCategoryAllocationAction(
  input: z.infer<typeof clearCategoryAllocationSchema>
): Promise<ActionResult> {
  const parsed = clearCategoryAllocationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const deleted = await service.clearCategoryAllocation(
      prisma,
      parsed.data.clientId,
      parsed.data.categoryId
    );
    if (!deleted) return {};
    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "delete",
      entityType: "category_vertical_allocation",
      entityId: deleted.id,
      before: { categoryId: deleted.categoryId, splits: deleted.splits },
      after: null,
    });
    await bumpAndRevalidate(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}
