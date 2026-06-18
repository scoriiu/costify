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

const employeeCountEntrySchema = z.object({
  month: z.number().int().min(1).max(12),
  count: z.number().min(0).max(100000),
});

const setEmployeeCountsSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  // The COMPLETE set of EXPLICIT values for this year. Months not listed are
  // cleared. Carry-forward (inherited months) is not stored; it is computed at
  // read time in employee-counts.ts.
  entries: z.array(employeeCountEntrySchema).max(12),
});

/**
 * Reconciles all EXPLICIT employee-count entries for one (client, year) in a
 * single transaction: upserts the provided months, deletes any previously
 * stored month for that year that is no longer present. Future months are
 * rejected server-side. Feeds headcount KPIs (venitPerAngajat,
 * profitPerAngajat), so it bumps the data version to invalidate caches.
 */
export async function setEmployeeCountsAction(input: {
  clientId: string;
  year: number;
  entries: Array<{ month: number; count: number }>;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Neautenticat" };

  const parsed = setEmployeeCountsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const client = await assertClientOwned(user.id, parsed.data.clientId);
  if (!client) return { ok: false, error: "Client negasit" };

  const { clientId, year, entries } = parsed.data;

  // Guard against future months for the current year.
  const now = new Date();
  const maxMonth = year > now.getFullYear() ? 0 : year === now.getFullYear() ? now.getMonth() + 1 : 12;
  if (entries.some((e) => e.month > maxMonth)) {
    return { ok: false, error: "Nu poti seta numarul de angajati pentru luni viitoare." };
  }

  // Reject duplicate months in the payload.
  const months = new Set(entries.map((e) => e.month));
  if (months.size !== entries.length) {
    return { ok: false, error: "Luni duplicate in cerere." };
  }

  const existing = await prisma.employeeCount.findMany({
    where: { clientId, year },
    select: { month: true, count: true },
  });
  const existingByMonth = new Map(existing.map((e) => [e.month, Number(e.count)]));
  const keepMonths = new Set(entries.map((e) => e.month));
  const toDelete = existing.filter((e) => !keepMonths.has(e.month)).map((e) => e.month);

  const changed =
    toDelete.length > 0 ||
    entries.some((e) => existingByMonth.get(e.month) !== e.count);
  if (!changed) return { ok: true };

  await prisma.$transaction([
    ...(toDelete.length > 0
      ? [prisma.employeeCount.deleteMany({ where: { clientId, year, month: { in: toDelete } } })]
      : []),
    ...entries.map((e) =>
      prisma.employeeCount.upsert({
        where: { clientId_year_month: { clientId, year, month: e.month } },
        create: { clientId, year, month: e.month, count: e.count },
        update: { count: e.count },
      })
    ),
  ]);

  await recordClientMutation({
    clientId,
    actorId: user.id,
    action: "update",
    entityType: "employee_count",
    entityId: `${clientId}:${year}`,
    before: { entries: existing.map((e) => ({ month: e.month, count: Number(e.count) })) },
    after: { entries },
    metadata: { year, deleted: toDelete },
  });

  await bumpClientDataVersion(clientId);
  revalidatePath(`/clients/${client.slug}`);
  return { ok: true };
}
