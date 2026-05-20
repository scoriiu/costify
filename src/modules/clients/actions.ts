"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { uniqueSlug } from "@/lib/slug";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import {
  createTransition,
  updateTransition,
  deleteTransition,
} from "./tax-regime";
import type { TaxRegime } from "@/modules/accounts";
import { recordClientMutation } from "@/modules/audit";

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

  const created = await prisma.client.create({
    data: { ...parsed.data, slug, userId: user.id },
    select: { id: true, taxRegime: true },
  });

  // Seed inception transition so the resolver always finds a match.
  await prisma.taxRegimePeriod.create({
    data: {
      clientId: created.id,
      startDate: new Date("1970-01-01T00:00:00.000Z"),
      taxRegime: created.taxRegime,
      reason: null,
      createdBy: user.id,
    },
  });

  await recordClientMutation({
    clientId: created.id,
    actorId: user.id,
    action: "create",
    entityType: "client",
    entityId: created.id,
    before: null,
    after: {
      name: parsed.data.name,
      cui: parsed.data.cui ?? null,
      caen: parsed.data.caen ?? null,
      taxRegime: created.taxRegime,
    },
    metadata: { slug },
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
): Promise<{ slug: string; name: string } | null> {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true, slug: true, name: true },
  });
  if (!row || row.userId !== userId) return null;
  return { slug: row.slug, name: row.name };
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

  const existing = await prisma.clientAccount.findUnique({
    where: { clientId_code: { clientId: parsed.data.clientId, code: parsed.data.code } },
    select: { customName: true },
  });

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

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: existing ? "update" : "create",
    entityType: "client_account",
    entityId: parsed.data.code,
    before: existing ? { customName: existing.customName } : null,
    after: { customName: parsed.data.name.trim() },
    metadata: { code: parsed.data.code },
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

  const existing = await prisma.clientAccount.findUnique({
    where: { clientId_code: { clientId: parsed.data.clientId, code: parsed.data.code } },
    select: { needsReview: true },
  });

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

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: "update",
    entityType: "client_account_review",
    entityId: parsed.data.code,
    before: existing ? { needsReview: existing.needsReview } : null,
    after: { needsReview: parsed.data.needsReview },
    metadata: { code: parsed.data.code },
  });

  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}

/**
 * @deprecated Use createTaxRegimeTransitionAction instead. Kept for any remaining
 * callers until all UI surfaces are migrated. It still updates the legacy
 * Client.taxRegime column so the resolver's fallback path sees the new value.
 */
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

  const before = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { taxRegime: true },
  });

  await prisma.client.update({
    where: { id: parsed.data.clientId },
    data: { taxRegime: parsed.data.taxRegime },
  });

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: "update",
    entityType: "tax_regime_legacy",
    entityId: parsed.data.clientId,
    before: before ? { taxRegime: before.taxRegime } : null,
    after: { taxRegime: parsed.data.taxRegime },
    metadata: { deprecated: true },
  });

  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Tax regime timeline actions (new model)
// ──────────────────────────────────────────────────────────────────────────

const createTransitionSchema = z.object({
  clientId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
  taxRegime: z.enum(TAX_REGIMES),
  reason: z.string().max(500).optional().nullable(),
});

const updateTransitionSchema = z.object({
  clientId: z.string().min(1),
  transitionId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taxRegime: z.enum(TAX_REGIMES).optional(),
  reason: z.string().max(500).optional().nullable(),
});

const deleteTransitionSchema = z.object({
  clientId: z.string().min(1),
  transitionId: z.string().min(1),
});

function parseLocalDate(iso: string): Date {
  // Treat YYYY-MM-DD as UTC midnight so it lands on the intended calendar day.
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function createTaxRegimeTransitionAction(input: {
  clientId: string;
  startDate: string;
  taxRegime: string;
  reason?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = createTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  let createdId: string;
  try {
    const created = await createTransition({
      clientId: parsed.data.clientId,
      startDate: parseLocalDate(parsed.data.startDate),
      taxRegime: parsed.data.taxRegime as TaxRegime,
      reason: parsed.data.reason ?? null,
      createdBy: user.id,
    });
    createdId = created.id;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Unique")) {
      return {
        ok: false,
        error: "Exista deja o tranzitie la aceasta data. Sterge-o si adauga una noua sau editeaz-o pe cea existenta.",
      };
    }
    return { ok: false, error: "Nu am putut salva tranzitia" };
  }

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: "create",
    entityType: "tax_regime_transition",
    entityId: createdId,
    before: null,
    after: {
      startDate: parsed.data.startDate,
      taxRegime: parsed.data.taxRegime,
      reason: parsed.data.reason ?? null,
    },
    metadata: {},
  });

  revalidatePath(`/clients/${client.slug}`);
  revalidatePath(`/clients/${client.slug}/settings`);
  return { ok: true };
}

export async function updateTaxRegimeTransitionAction(input: {
  clientId: string;
  transitionId: string;
  startDate?: string;
  taxRegime?: string;
  reason?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = updateTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  // Capture before-state for audit
  const beforeRow = await prisma.taxRegimePeriod.findFirst({
    where: { id: parsed.data.transitionId, clientId: parsed.data.clientId },
    select: { startDate: true, taxRegime: true, reason: true },
  });

  let updated: { id: string; startDate: Date; taxRegime: string; reason: string | null } | null = null;
  try {
    updated = await updateTransition(parsed.data.clientId, parsed.data.transitionId, {
      startDate: parsed.data.startDate ? parseLocalDate(parsed.data.startDate) : undefined,
      taxRegime: parsed.data.taxRegime as TaxRegime | undefined,
      reason: parsed.data.reason === undefined ? undefined : parsed.data.reason ?? null,
    });
    if (!updated) return { ok: false, error: "Tranzitia nu a fost gasita" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Unique")) {
      return { ok: false, error: "Exista deja o tranzitie la aceasta data" };
    }
    return { ok: false, error: "Nu am putut actualiza tranzitia" };
  }

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: "update",
    entityType: "tax_regime_transition",
    entityId: parsed.data.transitionId,
    before: beforeRow
      ? {
          startDate: beforeRow.startDate.toISOString().slice(0, 10),
          taxRegime: beforeRow.taxRegime,
          reason: beforeRow.reason,
        }
      : null,
    after: {
      startDate: updated.startDate.toISOString().slice(0, 10),
      taxRegime: updated.taxRegime,
      reason: updated.reason,
    },
    metadata: {},
  });

  revalidatePath(`/clients/${client.slug}`);
  revalidatePath(`/clients/${client.slug}/settings`);
  return { ok: true };
}

export async function deleteTaxRegimeTransitionAction(input: {
  clientId: string;
  transitionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = deleteTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Date invalide" };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  const beforeRow = await prisma.taxRegimePeriod.findFirst({
    where: { id: parsed.data.transitionId, clientId: parsed.data.clientId },
    select: { startDate: true, taxRegime: true, reason: true },
  });

  const removed = await deleteTransition(parsed.data.clientId, parsed.data.transitionId);
  if (!removed) return { ok: false, error: "Tranzitia nu a fost gasita" };

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: "delete",
    entityType: "tax_regime_transition",
    entityId: parsed.data.transitionId,
    before: beforeRow
      ? {
          startDate: beforeRow.startDate.toISOString().slice(0, 10),
          taxRegime: beforeRow.taxRegime,
          reason: beforeRow.reason,
        }
      : null,
    after: null,
    metadata: {},
  });

  revalidatePath(`/clients/${client.slug}`);
  revalidatePath(`/clients/${client.slug}/settings`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Informatii generale — edit client name, CUI, CAEN
// ──────────────────────────────────────────────────────────────────────────

const updateClientInfoSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(2).max(200),
  cui: z.string().max(20).optional().nullable(),
  caen: z.string().max(10).optional().nullable(),
});

export async function updateClientInfoAction(input: {
  clientId: string;
  name: string;
  cui?: string | null;
  caen?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = updateClientInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  const before = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { name: true, cui: true, caen: true },
  });

  const after = {
    name: parsed.data.name.trim(),
    cui: parsed.data.cui?.trim() || null,
    caen: parsed.data.caen?.trim() || null,
  };

  await prisma.client.update({
    where: { id: parsed.data.clientId },
    data: after,
  });

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: user.id,
    action: "update",
    entityType: "client_info",
    entityId: parsed.data.clientId,
    before: before,
    after,
    metadata: {},
  });

  revalidatePath(`/clients/${client.slug}`);
  revalidatePath(`/clients/${client.slug}/settings`);
  return { ok: true };
}
