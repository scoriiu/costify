"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { recordClientMutation } from "@/modules/audit";
import { bumpClientDataVersion } from "@/modules/clients/data-version";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import * as service from "./service";
import type { CategoryKind, MappingScope } from "./types";

type ActionResult<T = void> = { error?: string; data?: T };

/**
 * Authorize and resolve a clientId for the calling accountant. Throws via
 * redirect when not authenticated. Returns null when the client doesn't
 * belong to this user (404-equivalent — never leak existence).
 */
async function authorizeClient(clientId: string): Promise<{ userId: string } | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id },
    select: { id: true },
  });
  if (!client) return null;

  return { userId: user.id };
}

const createCategorySchema = z.object({
  clientId: z.string().min(1),
  parentId: z.string().nullable(),
  name: z.string().min(1, "Numele categoriei este obligatoriu").max(80),
  kind: z.enum(["expense", "revenue"]),
});

export async function createCategoryAction(
  input: z.infer<typeof createCategorySchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await authorizeClient(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const created = await service.createCategory(prisma, {
      clientId: parsed.data.clientId,
      parentId: parsed.data.parentId,
      name: parsed.data.name,
      kind: parsed.data.kind as CategoryKind,
    });

    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "create",
      entityType: "cost_category",
      entityId: created.id,
      before: null,
      after: {
        name: created.name,
        kind: created.kind,
        parentId: created.parentId,
      },
    });

    await revalidateClient(parsed.data.clientId);
    return { data: { id: created.id } };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const renameCategorySchema = z.object({
  clientId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export async function renameCategoryAction(
  input: z.infer<typeof renameCategorySchema>
): Promise<ActionResult> {
  const parsed = renameCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await authorizeClient(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const existing = await prisma.costCategory.findFirst({
      where: { id: parsed.data.categoryId, clientId: parsed.data.clientId },
      select: { name: true },
    });
    if (!existing) return { error: "Categoria nu exista" };

    const updated = await service.renameCategory(
      prisma,
      parsed.data.clientId,
      parsed.data.categoryId,
      parsed.data.name
    );

    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "update",
      entityType: "cost_category",
      entityId: parsed.data.categoryId,
      before: { name: existing.name },
      after: { name: updated.name },
    });

    await revalidateClient(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const deleteCategorySchema = z.object({
  clientId: z.string().min(1),
  categoryId: z.string().min(1),
});

export async function deleteCategoryAction(
  input: z.infer<typeof deleteCategorySchema>
): Promise<ActionResult> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await authorizeClient(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const deleted = await service.deleteCategory(
      prisma,
      parsed.data.clientId,
      parsed.data.categoryId
    );

    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "delete",
      entityType: "cost_category",
      entityId: parsed.data.categoryId,
      before: {
        name: deleted.name,
        kind: deleted.kind,
        parentId: deleted.parentId,
      },
      after: null,
    });

    await revalidateClient(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const mapAccountSchema = z.object({
  clientId: z.string().min(1),
  cont: z.string().min(1).max(20),
  scope: z.enum(["contBase", "analytic"]),
  categoryId: z.string().min(1),
});

export async function mapAccountAction(
  input: z.infer<typeof mapAccountSchema>
): Promise<ActionResult> {
  const parsed = mapAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await authorizeClient(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const existing = await prisma.accountCategoryMapping.findFirst({
      where: { clientId: parsed.data.clientId, cont: parsed.data.cont },
      select: { id: true, categoryId: true, scope: true },
    });

    const updated = await service.mapAccount(prisma, {
      clientId: parsed.data.clientId,
      cont: parsed.data.cont,
      scope: parsed.data.scope as MappingScope,
      categoryId: parsed.data.categoryId,
    });

    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: existing ? "update" : "create",
      entityType: "account_category_mapping",
      entityId: updated.id,
      before: existing
        ? { cont: parsed.data.cont, categoryId: existing.categoryId, scope: existing.scope }
        : null,
      after: {
        cont: parsed.data.cont,
        categoryId: parsed.data.categoryId,
        scope: parsed.data.scope,
      },
    });

    await revalidateClient(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

const unmapAccountSchema = z.object({
  clientId: z.string().min(1),
  cont: z.string().min(1).max(20),
});

export async function unmapAccountAction(
  input: z.infer<typeof unmapAccountSchema>
): Promise<ActionResult> {
  const parsed = unmapAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const auth = await authorizeClient(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  try {
    const deleted = await service.unmapAccount(
      prisma,
      parsed.data.clientId,
      parsed.data.cont
    );
    if (!deleted) return {}; // nothing to do — already unmapped

    await recordClientMutation({
      clientId: parsed.data.clientId,
      actorId: auth.userId,
      action: "delete",
      entityType: "account_category_mapping",
      entityId: deleted.id,
      before: {
        cont: deleted.cont,
        categoryId: deleted.categoryId,
        scope: deleted.scope,
      },
      after: null,
    });

    await revalidateClient(parsed.data.clientId);
    return {};
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function revalidateClient(clientId: string): Promise<void> {
  // Two-step cache invalidation for every category/mapping mutation:
  //   1. Bump Client.dataVersion so any read keyed on (clientId, version) misses
  //      and recomputes. This is the correctness guarantee — no read can return
  //      a value computed against the pre-write data state.
  //   2. revalidatePath("/clients") so the Next.js render cache for the list
  //      page (which includes coverage/mapping summaries) drops too.
  await bumpClientDataVersion(clientId);
  revalidatePath("/clients");
}
