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

export async function updateTaxRegimeAction(
  clientId: string,
  taxRegime: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Unauthenticated" };

  const parsed = updateTaxRegimeSchema.safeParse({ clientId, taxRegime });
  if (!parsed.success) {
    return { ok: false, error: "Regim fiscal invalid" };
  }

  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { userId: true, slug: true },
  });
  if (!client || client.userId !== user.id) {
    return { ok: false, error: "Client negasit" };
  }

  await prisma.client.update({
    where: { id: parsed.data.clientId },
    data: { taxRegime: parsed.data.taxRegime },
  });

  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}
