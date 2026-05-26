"use server";

/**
 * Server actions for PartnerCategoryOverride. All entry points called from
 * the client UI (slide-panel, review queue, bulk apply) go through here so
 * we get auth + tenant boundary + audit + path revalidation in one place.
 *
 * Pattern matches src/modules/verticals/actions.ts — Zod validation,
 * authorize() guard, service call, recordClientMutation audit, revalidate.
 */

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import {
  recordClientMutation,
  listAccountantAuditTrail,
  type AccountantAuditRow,
} from "@/modules/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod/v4";
import * as service from "./service";
import * as loader from "./loader";
import type { PartnerCategoryOverrideRow, PartnerEntry } from "./types";
import { normalizePartnerName } from "@/lib/partner-normalize";

type ActionResult<T = void> = { error?: string; data?: T };

/** Convert a typed row into the loose Record shape expected by the audit
 *  before/after fields. JSON-friendly: Dates serialize as ISO strings. */
function toAuditSnapshot(
  row: PartnerCategoryOverrideRow | null
): Record<string, unknown> | null {
  if (!row) return null;
  return {
    id: row.id,
    contBase: row.contBase,
    partnerNameNormalized: row.partnerNameNormalized,
    partnerNameOriginal: row.partnerNameOriginal,
    categoryId: row.categoryId,
    source: row.source,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

async function authorize(
  clientId: string
): Promise<{ userId: string; clientSlug: string } | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId: user.id },
    select: { id: true, slug: true },
  });
  if (!client) return null;
  return { userId: user.id, clientSlug: client.slug };
}

/**
 * Confirm that the caller may attach a partner override to the given category
 * — i.e. the category exists, belongs to the same client, and (for sanity)
 * is of the matching kind for the cont's class.
 */
async function authorizeCategory(
  clientId: string,
  categoryId: string,
  expectedKind: "expense" | "revenue"
): Promise<boolean> {
  const cat = await prisma.costCategory.findFirst({
    where: { id: categoryId, clientId },
    select: { kind: true },
  });
  return cat !== null && cat.kind === expectedKind;
}

function revalidateMapariCashflow(clientSlug: string) {
  revalidatePath(`/clients/${clientSlug}`);
}

function kindForCont(contBase: string): "expense" | "revenue" | null {
  const first = contBase.charAt(0);
  if (first === "6") return "expense";
  if (first === "7") return "revenue";
  return null;
}

/* -------------------------------------------------------------------------- */
/*                                LOAD PANEL                                  */
/* -------------------------------------------------------------------------- */

const loadPanelSchema = z.object({
  clientId: z.string().min(1),
  contBase: z.string().min(1).max(20),
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
});

export interface PartnerPanelData {
  contBase: string;
  partners: PartnerEntry[];
  partnerRulaj: number;
  unresolvedRulaj: number;
}

/**
 * On-demand fetch when the slide-panel opens. Auth-checked wrapper around
 * loader.loadPartnersForCont. We keep this as a server action (not just a
 * server function call from a page) so the panel can re-fetch after a save
 * to show updated state without reloading the entire Mapari Cashflow page.
 */
export async function loadPartnerPanelAction(
  input: z.infer<typeof loadPanelSchema>
): Promise<ActionResult<PartnerPanelData>> {
  const parsed = loadPanelSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const result = await loader.loadPartnersForCont(
    prisma,
    parsed.data.clientId,
    parsed.data.contBase,
    parsed.data.year,
    parsed.data.month
  );

  return {
    data: {
      contBase: parsed.data.contBase,
      partners: result.partners,
      partnerRulaj: result.partnerRulaj,
      unresolvedRulaj: result.unresolvedRulaj,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                       SUGGESTION QUEUE (Sprint 5)                          */
/* -------------------------------------------------------------------------- */

const queueSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function loadSuggestionQueueAction(
  input: z.infer<typeof queueSchema>
): Promise<
  ActionResult<{ items: Awaited<ReturnType<typeof loader.loadSuggestionQueue>> }>
> {
  const parsed = queueSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const items = await loader.loadSuggestionQueue(
    prisma,
    parsed.data.clientId,
    parsed.data.year,
    parsed.data.month
  );
  return { data: { items } };
}

/* -------------------------------------------------------------------------- */
/*                  ALL-EXCEPTIONS VIEW (centralised list)                    */
/* -------------------------------------------------------------------------- */

export async function loadAllExceptionsAction(
  input: z.infer<typeof queueSchema>
): Promise<
  ActionResult<{ items: Awaited<ReturnType<typeof loader.loadAllExceptions>> }>
> {
  const parsed = queueSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const items = await loader.loadAllExceptions(
    prisma,
    parsed.data.clientId,
    parsed.data.year,
    parsed.data.month
  );
  return { data: { items } };
}

/* -------------------------------------------------------------------------- */
/*                          AUDIT TRAIL (Istoric)                             */
/* -------------------------------------------------------------------------- */

const auditTrailSchema = z.object({
  clientId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

/**
 * Load the audit trail entries that belong to the Mapari Cashflow surface:
 * partner overrides + bulk applies. Used by the "Istoric" tab inside
 * AllExceptionsDialog so the contabil can see exactly who changed what
 * and when, without leaving the workspace.
 *
 * Two DB roundtrips, one per entityType. We do this rather than a single
 * unfiltered query so the page bundle stays small even when the firm has
 * hundreds of unrelated audit events from other surfaces.
 */
export async function loadMapariCashflowAuditAction(
  input: z.infer<typeof auditTrailSchema>
): Promise<ActionResult<{ items: AccountantAuditRow[] }>> {
  const parsed = auditTrailSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const limit = parsed.data.limit ?? 100;
  const [single, bulk] = await Promise.all([
    listAccountantAuditTrail(parsed.data.clientId, {
      entityType: "partner_category_override",
      limit,
    }),
    listAccountantAuditTrail(parsed.data.clientId, {
      entityType: "partner_category_override_bulk",
      limit,
    }),
  ]);
  const merged = [...single, ...bulk].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return { data: { items: merged.slice(0, limit) } };
}

/* -------------------------------------------------------------------------- */
/*                              UPSERT (manual)                               */
/* -------------------------------------------------------------------------- */

const upsertSchema = z.object({
  clientId: z.string().min(1),
  contBase: z.string().min(1).max(20),
  partnerNameOriginal: z.string().min(1).max(200),
  categoryId: z.string().min(1),
  /** Skip the Next.js revalidatePath call. The optimistic flow in the
   *  slide-panel and AllExceptionsDialog patches local state and triggers
   *  router.refresh() exactly once at close, so per-action revalidations
   *  cause the dialog to flash mid-edit. Default false = preserve old
   *  behavior for non-optimistic callers (review queue, etc.). */
  skipRevalidate: z.boolean().optional(),
});

export async function upsertPartnerOverrideAction(
  input: z.infer<typeof upsertSchema>
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const kind = kindForCont(parsed.data.contBase);
  if (!kind) return { error: "Contul nu este de cheltuiala sau venit" };

  const okCategory = await authorizeCategory(
    parsed.data.clientId,
    parsed.data.categoryId,
    kind
  );
  if (!okCategory) {
    return {
      error:
        "Categoria nu apartine firmei sau nu se potriveste cu tipul contului",
    };
  }

  const partnerNameNormalized = normalizePartnerName(
    parsed.data.partnerNameOriginal
  );
  if (!partnerNameNormalized) {
    return { error: "Numele partenerului este gol dupa normalizare" };
  }

  // Capture before-state for audit (null if this is a fresh row).
  const existing = await prisma.partnerCategoryOverride.findUnique({
    where: {
      clientId_contBase_partnerNameNormalized: {
        clientId: parsed.data.clientId,
        contBase: parsed.data.contBase,
        partnerNameNormalized,
      },
    },
  });

  const row = await service.upsertOverride(prisma, {
    clientId: parsed.data.clientId,
    contBase: parsed.data.contBase,
    partnerNameNormalized,
    partnerNameOriginal: parsed.data.partnerNameOriginal,
    categoryId: parsed.data.categoryId,
    source: "manual",
  });

  // Enrich audit metadata with category names so the audit-log UI can
  // render a self-contained sentence without joining back to costCategory.
  // We fetch both names (before + after) when both exist so we can build
  // "schimbat din X in Y" messages.
  const beforeCatId = existing?.categoryId ?? null;
  const afterCatId = row.categoryId;
  const catNames = await prisma.costCategory.findMany({
    where: {
      clientId: parsed.data.clientId,
      id: { in: Array.from(new Set([beforeCatId, afterCatId].filter(Boolean) as string[])) },
    },
    select: { id: true, name: true },
  });
  const nameById = new Map(catNames.map((c) => [c.id, c.name]));

  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: auth.userId,
    action: existing ? "update" : "create",
    entityType: "partner_category_override",
    entityId: row.id,
    before: toAuditSnapshot(existing as unknown as PartnerCategoryOverrideRow | null),
    after: toAuditSnapshot(row),
    metadata: {
      contBase: parsed.data.contBase,
      partnerName: parsed.data.partnerNameOriginal,
      categoryName: nameById.get(afterCatId) ?? null,
      previousCategoryName: beforeCatId ? nameById.get(beforeCatId) ?? null : null,
    },
  });

  if (!parsed.data.skipRevalidate) revalidateMapariCashflow(auth.clientSlug);
  return { data: { id: row.id } };
}

/* -------------------------------------------------------------------------- */
/*                                CONFIRM                                     */
/* -------------------------------------------------------------------------- */

const confirmSchema = z.object({
  clientId: z.string().min(1),
  id: z.string().min(1),
  skipRevalidate: z.boolean().optional(),
});

export async function confirmPartnerOverrideAction(
  input: z.infer<typeof confirmSchema>
): Promise<ActionResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  // Confirm we're not cross-tenant before touching the row.
  const existing = await prisma.partnerCategoryOverride.findFirst({
    where: { id: parsed.data.id, clientId: parsed.data.clientId },
  });
  if (!existing) return { error: "Maparea nu exista sau nu apartine firmei" };

  const row = await service.confirmOverride(prisma, parsed.data.id);
  const cat = await prisma.costCategory.findFirst({
    where: { id: row.categoryId, clientId: parsed.data.clientId },
    select: { name: true },
  });
  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: auth.userId,
    action: "approve",
    entityType: "partner_category_override",
    entityId: row.id,
    before: toAuditSnapshot(existing as unknown as PartnerCategoryOverrideRow | null),
    after: toAuditSnapshot(row),
    metadata: {
      contBase: row.contBase,
      partnerName: row.partnerNameOriginal,
      categoryName: cat?.name ?? null,
    },
  });

  if (!parsed.data.skipRevalidate) revalidateMapariCashflow(auth.clientSlug);
  return {};
}

/* -------------------------------------------------------------------------- */
/*                                  DELETE                                    */
/* -------------------------------------------------------------------------- */

const deleteSchema = z.object({
  clientId: z.string().min(1),
  id: z.string().min(1),
  skipRevalidate: z.boolean().optional(),
});

export async function deletePartnerOverrideAction(
  input: z.infer<typeof deleteSchema>
): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const existing = await prisma.partnerCategoryOverride.findFirst({
    where: { id: parsed.data.id, clientId: parsed.data.clientId },
  });
  if (!existing) return { error: "Maparea nu exista sau nu apartine firmei" };

  const previousCat = existing.categoryId
    ? await prisma.costCategory.findFirst({
        where: { id: existing.categoryId, clientId: parsed.data.clientId },
        select: { name: true },
      })
    : null;

  await service.deleteOverride(prisma, parsed.data.id);
  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: auth.userId,
    action: "delete",
    entityType: "partner_category_override",
    entityId: parsed.data.id,
    before: toAuditSnapshot(existing as unknown as PartnerCategoryOverrideRow | null),
    after: null,
    metadata: {
      contBase: existing.contBase,
      partnerName: existing.partnerNameOriginal,
      previousCategoryName: previousCat?.name ?? null,
    },
  });

  if (!parsed.data.skipRevalidate) revalidateMapariCashflow(auth.clientSlug);
  return {};
}

/* -------------------------------------------------------------------------- */
/*                                BULK APPLY                                  */
/* -------------------------------------------------------------------------- */

const bulkApplySchema = z.object({
  clientId: z.string().min(1),
  contBase: z.string().min(1).max(20),
  categoryId: z.string().min(1),
  partners: z
    .array(
      z.object({
        nameOriginal: z.string().min(1).max(200),
      })
    )
    .max(1000), // safety cap; a single cont with 1000+ partners is pathological
  skipExistingOverrides: z.boolean().optional(),
  skipRevalidate: z.boolean().optional(),
});

export async function bulkApplyPartnerOverridesAction(
  input: z.infer<typeof bulkApplySchema>
): Promise<ActionResult<{ applied: number; skipped: number }>> {
  const parsed = bulkApplySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };

  const kind = kindForCont(parsed.data.contBase);
  if (!kind) return { error: "Contul nu este de cheltuiala sau venit" };

  const okCategory = await authorizeCategory(
    parsed.data.clientId,
    parsed.data.categoryId,
    kind
  );
  if (!okCategory) {
    return {
      error:
        "Categoria nu apartine firmei sau nu se potriveste cu tipul contului",
    };
  }

  // Normalize on the server — never trust client-side normalization.
  const partners = parsed.data.partners
    .map((p) => ({
      nameOriginal: p.nameOriginal,
      nameNormalized: normalizePartnerName(p.nameOriginal),
    }))
    .filter((p) => p.nameNormalized !== "");

  const result = await service.bulkApplyOverrides(prisma, {
    clientId: parsed.data.clientId,
    contBase: parsed.data.contBase,
    categoryId: parsed.data.categoryId,
    source: "bulk",
    partners,
    skipExistingOverrides: parsed.data.skipExistingOverrides,
  });

  const bulkCat = await prisma.costCategory.findFirst({
    where: { id: parsed.data.categoryId, clientId: parsed.data.clientId },
    select: { name: true },
  });
  await recordClientMutation({
    clientId: parsed.data.clientId,
    actorId: auth.userId,
    action: "create",
    entityType: "partner_category_override_bulk",
    entityId: parsed.data.contBase,
    before: null,
    after: {
      contBase: parsed.data.contBase,
      categoryId: parsed.data.categoryId,
      applied: result.applied,
      skipped: result.skipped,
    },
    metadata: {
      contBase: parsed.data.contBase,
      categoryName: bulkCat?.name ?? null,
      applied: result.applied,
      skipped: result.skipped,
    },
  });

  if (!parsed.data.skipRevalidate) revalidateMapariCashflow(auth.clientSlug);
  return { data: result };
}

/* -------------------------------------------------------------------------- */
/*                          REVALIDATE (deferred)                             */
/* -------------------------------------------------------------------------- */

const revalidateSchema = z.object({ clientId: z.string().min(1) });

/**
 * Trigger Next.js path revalidation for the client's Mapari Cashflow page.
 * Used by the optimistic-save flow: per-row mutations skip revalidate to
 * keep the modal flicker-free; the dialog calls this exactly once on
 * close so the underlying workspace picks up the changes.
 */
export async function revalidateMapariCashflowAction(
  input: z.infer<typeof revalidateSchema>
): Promise<ActionResult> {
  const parsed = revalidateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const auth = await authorize(parsed.data.clientId);
  if (!auth) return { error: "Firma nu exista sau nu ai acces" };
  revalidateMapariCashflow(auth.clientSlug);
  return {};
}
