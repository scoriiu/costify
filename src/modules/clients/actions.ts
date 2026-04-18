"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { uniqueSlug } from "@/lib/slug";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";

const createClientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  cui: z.string().max(20).optional(),
  caen: z.string().max(10).optional(),
});

const TAX_REGIMES = [
  "profit_standard",
  "profit_micro_1",
  "profit_micro_3",
  "profit_specific",
  "imca",
  "deferred",
] as const;

const updateTaxRegimeSchema = z.object({
  clientId: z.string().min(1),
  taxRegime: z.enum(TAX_REGIMES),
});

type ActionResult = { error?: string };

export async function createClientAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const raw = {
    name: formData.get("name") as string,
    cui: (formData.get("cui") as string) || undefined,
    caen: (formData.get("caen") as string) || undefined,
  };

  const parsed = createClientSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const slug = await uniqueSlug(parsed.data.name, async (s) => {
    const existing = await prisma.client.findUnique({
      where: { userId_slug: { userId: user.id, slug: s } },
    });
    return !!existing;
  });

  await prisma.client.create({
    data: { ...parsed.data, slug, userId: user.id },
  });

  redirect("/clients");
}

const MAX_ACCOUNT_NAME = 200;

const updateAccountNameSchema = z.object({
  clientId: z.string().min(1),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(MAX_ACCOUNT_NAME),
});

const toggleReviewSchema = z.object({
  clientId: z.string().min(1),
  code: z.string().min(1).max(50),
  needsReview: z.boolean(),
});

async function assertClientOwned(
  userId: string,
  clientId: string
): Promise<{ slug: string } | null> {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true, slug: true },
  });
  if (!row || row.userId !== userId) return null;
  return { slug: row.slug };
}

/**
 * Edit the customName of a client's analytic/standard account.
 * Sets source="user_edit" so future Saga reimports won't overwrite it (D10).
 */
export async function updateClientAccountNameAction(
  clientId: string,
  code: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = updateAccountNameSchema.safeParse({ clientId, code, name });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  await prisma.clientAccount.upsert({
    where: {
      clientId_code: { clientId: parsed.data.clientId, code: parsed.data.code },
    },
    create: {
      clientId: parsed.data.clientId,
      code: parsed.data.code,
      customName: parsed.data.name.trim(),
      source: "user_edit",
    },
    update: {
      customName: parsed.data.name.trim(),
      source: "user_edit",
      lastSeenAt: new Date(),
    },
  });

  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}

/**
 * Toggle the needsReview flag — accountant marks an unknown-base account
 * as reviewed (OK to keep) or flags it again.
 */
export async function toggleClientAccountReviewAction(
  clientId: string,
  code: string,
  needsReview: boolean
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = toggleReviewSchema.safeParse({ clientId, code, needsReview });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  await prisma.clientAccount.upsert({
    where: {
      clientId_code: { clientId: parsed.data.clientId, code: parsed.data.code },
    },
    create: {
      clientId: parsed.data.clientId,
      code: parsed.data.code,
      customName: `Cont ${parsed.data.code}`,
      source: "user_edit",
      needsReview: parsed.data.needsReview,
    },
    update: {
      needsReview: parsed.data.needsReview,
    },
  });

  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}

export async function updateTaxRegimeAction(
  clientId: string,
  taxRegime: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = updateTaxRegimeSchema.safeParse({ clientId, taxRegime });
  if (!parsed.success) {
    return { ok: false, error: "Regim fiscal invalid" };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  await prisma.client.update({
    where: { id: parsed.data.clientId },
    data: { taxRegime: parsed.data.taxRegime },
  });

  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}
