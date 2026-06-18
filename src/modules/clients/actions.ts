"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { uniqueSlug } from "@/lib/slug";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import { recordClientMutation } from "@/modules/audit";
import { bumpClientDataVersion } from "@/modules/clients/data-version";
import { industryFromCaen, industryLabel } from "@/modules/reporting/industry";
import { lookupCompanyByCui, type AnafCompanyData } from "@/modules/integrations/anaf";

const createClientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  cui: z.string().max(20).optional(),
  caen: z.string().max(10).optional(),
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

  // ClientAccount.customName feeds every downstream computed surface that
  // renders account names (Balanta, CPP, Mapari, owner snapshot). Bump the
  // version so cached results recompute on the next read.
  await bumpClientDataVersion(parsed.data.clientId);
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

  // needsReview can flow into the `unmapped` flag surfaced by buildAccountMetadata;
  // bump so cached balance / KPIs / Mapari recompute and reflect the toggle.
  await bumpClientDataVersion(parsed.data.clientId);
  revalidatePath(`/clients/${client.slug}`);
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
  /** Explicit industry pick. "auto" = clear manual override, re-detect from CAEN. */
  industry: z
    .enum(["auto", "general", "consultanta", "retail", "telecom", "banking", "servicii_contabile", "inchirieri"])
    .optional(),
});

export async function updateClientInfoAction(input: {
  clientId: string;
  name: string;
  cui?: string | null;
  caen?: string | null;
  industry?: string;
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
    select: { name: true, cui: true, caen: true, industry: true, industrySource: true },
  });

  const newCaen = parsed.data.caen?.trim() || null;

  // Industry resolution:
  //   - explicit pick -> manual (auto-detect never overwrites it)
  //   - "auto" or no pick -> derive from CAEN, unless an existing manual
  //     selection is kept and the caller didn't ask to reset it
  let industry: string | null;
  let industrySource: string | null;
  if (parsed.data.industry && parsed.data.industry !== "auto") {
    industry = parsed.data.industry;
    industrySource = "manual";
  } else if (
    parsed.data.industry !== "auto" &&
    before?.industrySource === "manual"
  ) {
    industry = before.industry;
    industrySource = "manual";
  } else {
    industry = industryFromCaen(newCaen) ?? "general";
    industrySource = "auto";
  }

  const after = {
    name: parsed.data.name.trim(),
    cui: parsed.data.cui?.trim() || null,
    caen: newCaen,
    industry,
    industrySource,
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

  // Industry/CAEN feed the owner snapshot (industry KPI section) — cached
  // outputs must become unreachable when they change.
  if (
    before?.caen !== after.caen ||
    before?.industry !== after.industry ||
    before?.industrySource !== after.industrySource
  ) {
    await bumpClientDataVersion(parsed.data.clientId);
  }

  revalidatePath(`/clients/${client.slug}`);
  revalidatePath(`/clients/${client.slug}/settings`);
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// ANAF lookup
// ──────────────────────────────────────────────────────────────────────────

export interface AnafLookupResult {
  ok: boolean;
  error?: string;
  data?: AnafCompanyData & {
    /** Industry detected from the fetched CAEN, for instant UI feedback. */
    detectedIndustry: string | null;
    detectedIndustryLabel: string | null;
  };
}

/**
 * Fetches company registry data from the free ANAF public web service.
 * Read-only: returns the data for the UI to prefill, never writes the
 * client record (the accountant reviews and saves explicitly).
 */
export async function lookupCuiAction(rawCui: string): Promise<AnafLookupResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const result = await lookupCompanyByCui(rawCui);
  if (!result.ok) return { ok: false, error: result.error.message };

  const detected = industryFromCaen(result.data.caen);
  return {
    ok: true,
    data: {
      ...result.data,
      detectedIndustry: detected,
      detectedIndustryLabel: detected ? industryLabel(detected) : null,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Employee count (monthly auxiliary input)
// ──────────────────────────────────────────────────────────────────────────

const setEmployeeCountSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  // null clears the value for that month; a number sets it (0..100000, 2 decimals)
  count: z.number().min(0).max(100000).nullable(),
});

/**
 * Sets (or clears, when count is null) the average employee count for one
 * (client, year, month). Feeds headcount KPIs (venitPerAngajat,
 * profitPerAngajat) in the owner snapshot + KPI tab, so it MUST bump the
 * data version to invalidate cached computed outputs.
 */
export async function setEmployeeCountAction(input: {
  clientId: string;
  year: number;
  month: number;
  count: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = setEmployeeCountSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  const { clientId, year, month, count } = parsed.data;
  const where = { clientId_year_month: { clientId, year, month } };

  const existing = await prisma.employeeCount.findUnique({
    where,
    select: { count: true },
  });
  const before = existing ? { count: Number(existing.count) } : null;

  if (count === null) {
    if (!existing) return { ok: true }; // nothing to clear
    await prisma.employeeCount.delete({ where });
  } else {
    await prisma.employeeCount.upsert({
      where,
      create: { clientId, year, month, count },
      update: { count },
    });
  }

  await recordClientMutation({
    clientId,
    actorId: user.id,
    action: count === null ? "delete" : existing ? "update" : "create",
    entityType: "employee_count",
    entityId: `${clientId}:${year}-${String(month).padStart(2, "0")}`,
    before,
    after: count === null ? null : { count },
    metadata: { year, month },
  });

  await bumpClientDataVersion(clientId);
  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}
