/**
 * Enriched audit trail readers for UI use.
 *
 * `queryAuditTrail` returns raw AuditRecord rows (actorId only). The "Istoric
 * actiuni" UI needs the actor's display name plus a translation of the event
 * shape into a human sentence in Romanian. Two output shapes are supported:
 *
 *  - listAccountantAuditTrail: detailed view for the cabinet. Shows entity
 *    type, action verb, before/after summary, actor name and time.
 *  - listOwnerAuditTrail: same data, filtered + translated into plain
 *    entrepreneur language (no account codes, no internal entity names).
 *
 * Both run a single DB query then enrich in memory.
 */

import { prisma } from "@/lib/db";
import type { AuditRecord } from "./types";
import type { PipelineStage, ActorType } from "@/shared/types";

export interface AccountantAuditRow {
  id: string;
  createdAt: Date;
  actorName: string;
  actorEmail: string | null;
  /** Romanian verb phrase, e.g. "a publicat luna aprilie 2026" */
  description: string;
  /** Underlying entity_type for filtering. */
  entityType: string;
  action: AuditRecord["action"];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface OwnerAuditRow {
  id: string;
  createdAt: Date;
  /** Translated, jargon-free Romanian sentence. */
  description: string;
}

export interface AuditTrailOptions {
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
}

interface RawAuditWithActor {
  id: string;
  tenantId: string;
  actorId: string;
  actorType: string;
  pipelineStage: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  checksum: string;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
}

/**
 * Single-roundtrip audit fetch with actor enrichment. Replaces the old
 * queryAuditTrail() + enrichActors() pair that did two sequential SELECTs
 * (one for events, one IN-query for users). The LEFT JOIN keeps system /
 * deleted actors visible — they just come back with actorName = null,
 * matching the previous behaviour of "Sistem" fallback in the caller.
 *
 * Note: we keep queryAuditTrail() exported for the other consumers that
 * don't need actor enrichment. This raw variant is local to the UI loader
 * because the projection is UI-shaped (we eagerly include name/email).
 */
async function queryAuditTrailWithActors(
  clientId: string,
  opts: AuditTrailOptions
): Promise<RawAuditWithActor[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;
  const entityType = opts.entityType ?? null;
  const startDate = opts.startDate ?? null;
  const endDate = opts.endDate ?? null;

  return prisma.$queryRaw<RawAuditWithActor[]>`
    SELECT
      ae.id,
      ae."tenantId",
      ae."actorId",
      ae."actorType",
      ae."pipelineStage",
      ae.action,
      ae."entityType",
      ae."entityId",
      ae.before,
      ae.after,
      ae.metadata,
      ae.checksum,
      ae."createdAt",
      u.name  AS "actorName",
      u.email AS "actorEmail"
    FROM "AuditEvent" ae
    LEFT JOIN "User" u ON u.id = ae."actorId"
    WHERE ae."tenantId" = ${clientId}
      AND (${entityType}::text IS NULL OR ae."entityType" = ${entityType}::text)
      AND (${startDate}::timestamp IS NULL OR ae."createdAt" >= ${startDate}::timestamp)
      AND (${endDate}::timestamp   IS NULL OR ae."createdAt" <= ${endDate}::timestamp)
    ORDER BY ae."createdAt" DESC
    OFFSET ${offset} LIMIT ${limit}
  `;
}

function toAuditRecord(raw: RawAuditWithActor): AuditRecord {
  return {
    id: raw.id,
    tenantId: raw.tenantId,
    actorId: raw.actorId,
    actorType: raw.actorType as ActorType,
    pipelineStage: raw.pipelineStage as PipelineStage,
    action: raw.action as AuditRecord["action"],
    entityType: raw.entityType,
    entityId: raw.entityId,
    before: (raw.before as Record<string, unknown>) ?? null,
    after: (raw.after as Record<string, unknown>) ?? null,
    metadata: (raw.metadata as Record<string, unknown>) ?? {},
    checksum: raw.checksum,
    createdAt: raw.createdAt,
  };
}

export async function listAccountantAuditTrail(
  clientId: string,
  opts: AuditTrailOptions = {}
): Promise<AccountantAuditRow[]> {
  const rows = await queryAuditTrailWithActors(clientId, opts);

  return rows.map((raw) => {
    const record = toAuditRecord(raw);
    return {
      id: record.id,
      createdAt: record.createdAt,
      actorName: raw.actorName ?? "Sistem",
      actorEmail: raw.actorEmail,
      description: describeForAccountant(record),
      entityType: record.entityType,
      action: record.action,
      before: record.before,
      after: record.after,
      metadata: record.metadata,
    };
  });
}

export async function listOwnerAuditTrail(
  clientId: string,
  opts: AuditTrailOptions = {}
): Promise<OwnerAuditRow[]> {
  const rows = await queryAuditTrailWithActors(clientId, opts);

  return rows
    .map((raw) => ({ record: toAuditRecord(raw), actorName: raw.actorName }))
    .filter(({ record }) => isVisibleToOwner(record))
    .map(({ record, actorName }) => ({
      id: record.id,
      createdAt: record.createdAt,
      description: describeForOwner(record, actorName ?? "Contabilul tau"),
    }));
}

const MONTH_NAMES_RO = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_RO[month - 1]} ${year}`;
}

/**
 * Map an AuditRecord to a Romanian sentence for the accountant view.
 * Detailed and uses OMFP terminology where appropriate.
 */
function describeForAccountant(r: AuditRecord): string {
  const meta = r.metadata ?? {};
  const after = r.after ?? {};
  const before = r.before ?? {};

  switch (r.entityType) {
    case "published_period": {
      const year = pickNumber(after, "year") ?? pickNumber(before, "year");
      const month = pickNumber(after, "month") ?? pickNumber(before, "month");
      const period = year && month ? monthLabel(year, month) : "luna";
      if (r.action === "create") return `a publicat ${period}`;
      if (r.action === "update") return `a re-publicat ${period}`;
      if (r.action === "delete") return `a retras publicarea pentru ${period}`;
      return `${r.action} pe ${period}`;
    }
    case "firma_dashboard": {
      const page = pickString(meta, "page") ?? "home";
      const mode = pickString(meta, "viewMode") ?? "";
      const who = pickString(meta, "actorRole") === "ACCOUNTANT" ? "a vizualizat firma" : "a deschis firma";
      return `${who} (${page}${mode ? ", " + mode : ""})`;
    }
    case "client_access": {
      if (r.action === "grant") {
        const email = pickString(after, "userEmail") ?? "patron";
        return `a oferit acces firmei ${email}`;
      }
      if (r.action === "revoke") {
        const email = pickString(before, "userEmail") ?? "patron";
        return `a revocat accesul firmei ${email}`;
      }
      return `${r.action} pe acces firma`;
    }
    case "tax_regime_transition": {
      const regime = pickString(after, "taxRegime") ?? pickString(before, "taxRegime") ?? "";
      const date = pickString(after, "startDate") ?? pickString(before, "startDate") ?? "";
      if (r.action === "create") return `a adaugat o tranzitie de regim fiscal: ${regime} de la ${date}`;
      if (r.action === "update") return `a modificat o tranzitie de regim fiscal (${regime}, ${date})`;
      if (r.action === "delete") return `a sters o tranzitie de regim fiscal (${regime}, ${date})`;
      return `${r.action} regim fiscal`;
    }
    case "tax_regime_legacy":
      return `a modificat regimul fiscal (legacy) la ${pickString(after, "taxRegime") ?? ""}`;
    case "client":
      if (r.action === "create") {
        return `a creat firma ${pickString(after, "name") ?? ""}`;
      }
      return `${r.action} firma`;
    case "client_info":
      return `a actualizat datele firmei (nume/CUI/CAEN)`;
    case "client_account": {
      const code = pickString(meta, "code") ?? "";
      return `a redenumit contul ${code}`;
    }
    case "client_account_review": {
      const code = pickString(meta, "code") ?? "";
      const needs = (after as { needsReview?: boolean }).needsReview;
      return needs ? `a marcat contul ${code} pentru revizuire` : `a confirmat contul ${code}`;
    }
    case "import_event":
      return `a importat un jurnal (${pickNumber(after, "entriesAdded") ?? 0} intrari noi)`;
    case "journal_lines":
      if (r.action === "delete") {
        const n = pickNumber(meta, "totalDeleted") ?? 0;
        const from = pickString(meta, "fromDate") ?? "";
        return `a sters ${n} intrari de jurnal incepand cu ${from.slice(0, 10)}`;
      }
      return `${r.action} pe jurnal`;
    case "partner_category_override": {
      // Mapari Cashflow → partner-level exceptions on a cont.
      // Metadata is enriched at write time so we don't need a DB join here.
      const cont = pickString(meta, "contBase") ?? "?";
      const partner = pickString(meta, "partnerName") ?? "partener";
      const cat = pickString(meta, "categoryName");
      const prevCat = pickString(meta, "previousCategoryName");
      if (r.action === "create") {
        return cat
          ? `a creat o exceptie: pe cont ${cont}, partenerul "${partner}" merge in "${cat}"`
          : `a creat o exceptie pentru "${partner}" pe cont ${cont}`;
      }
      if (r.action === "update") {
        if (cat && prevCat) {
          return `a mutat "${partner}" pe cont ${cont} din "${prevCat}" in "${cat}"`;
        }
        return cat
          ? `a actualizat exceptia pentru "${partner}" pe cont ${cont} → "${cat}"`
          : `a actualizat exceptia pentru "${partner}" pe cont ${cont}`;
      }
      if (r.action === "delete") {
        return prevCat
          ? `a sters exceptia pentru "${partner}" pe cont ${cont} (era "${prevCat}", revine la linia de cost a contului)`
          : `a sters exceptia pentru "${partner}" pe cont ${cont}`;
      }
      if (r.action === "approve") {
        return cat
          ? `a confirmat sugestia pentru "${partner}" pe cont ${cont} → "${cat}"`
          : `a confirmat o sugestie pentru "${partner}" pe cont ${cont}`;
      }
      return `${r.action} pe exceptia "${partner}" / ${cont}`;
    }
    case "partner_category_override_bulk": {
      const cont = pickString(meta, "contBase") ?? "?";
      const cat = pickString(meta, "categoryName");
      const applied = pickNumber(meta, "applied") ?? 0;
      const skipped = pickNumber(meta, "skipped") ?? 0;
      const tail = skipped > 0 ? ` (${skipped} sariti)` : "";
      return cat
        ? `a aplicat in bulk ${applied} parteneri pe cont ${cont} → "${cat}"${tail}`
        : `a aplicat in bulk ${applied} parteneri pe cont ${cont}${tail}`;
    }
    default:
      return `${r.action} pe ${r.entityType}`;
  }
}

/**
 * Owner-language sentence. Strips OMFP jargon ("regim fiscal", "cont 401")
 * and substitutes entrepreneur-friendly words.
 */
function describeForOwner(r: AuditRecord, actorName: string): string {
  const meta = r.metadata ?? {};
  const after = r.after ?? {};
  const before = r.before ?? {};

  switch (r.entityType) {
    case "published_period": {
      const year = pickNumber(after, "year") ?? pickNumber(before, "year");
      const month = pickNumber(after, "month") ?? pickNumber(before, "month");
      const period = year && month ? monthLabel(year, month) : "o luna";
      if (r.action === "create") return `${actorName} ti-a publicat ${period}`;
      if (r.action === "update") return `${actorName} a actualizat datele pentru ${period}`;
      if (r.action === "delete") return `${actorName} a retras temporar datele pentru ${period}`;
      return `${actorName} a modificat ${period}`;
    }
    case "client_access":
      if (r.action === "grant") return `${actorName} ti-a oferit acces la firma`;
      if (r.action === "revoke") return `${actorName} a revocat accesul`;
      return `${actorName} a modificat accesul tau`;
    case "import_event":
      return `${actorName} a adaugat date noi din contabilitate`;
    case "journal_lines":
      if (r.action === "delete") {
        return `${actorName} a curatat niste inregistrari vechi pentru corectie`;
      }
      return `${actorName} a modificat inregistrari`;
    case "client_info":
      return `${actorName} a actualizat datele firmei`;
    default:
      return ""; // hidden (filtered out by isVisibleToOwner)
  }
}

/**
 * Decides whether a given audit event is meaningful for the OWNER's view.
 * Internal pipeline noise (balance recalc, classification rules) is hidden;
 * user-visible business events (publish, import, access change) are shown.
 */
function isVisibleToOwner(r: AuditRecord): boolean {
  const visibleTypes = new Set([
    "published_period",
    "client_access",
    "import_event",
    "journal_lines",
    "client_info",
  ]);
  return visibleTypes.has(r.entityType);
}

function pickNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" ? v : null;
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}
