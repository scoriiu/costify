import type { OwnerSnapshot } from "@/modules/reporting/owner";

/** Current snapshot schema version. Bump when OwnerSnapshot's shape changes.
 *
 *  Version history:
 *    1 — initial: meta + summary + cashPosition + ownerWithdrawals + trends +
 *        insights + outstanding.
 *    2 — adds expenseBreakdown, revenueBreakdown, topMonthlyExpenses, runway,
 *        salaryAffordability, yoy.
 *
 *  Note about PR-2b: We introduced CostCategory mappings that change the
 *  CONTENT of expenseBreakdown/revenueBreakdown items (custom labels and ids
 *  instead of OMFP 2-digit codes), but the SHAPE stays identical
 *  (CategoryBreakdownItem unchanged). No version bump needed — old published
 *  snapshots remain renderable.
 */
export const SNAPSHOT_VERSION = 2;

/**
 * Frozen representation of one published (client, year, month) period.
 * Reconstructed from a Prisma row plus the deserialized snapshot JSON.
 */
export interface PublishedPeriodSummary {
  id: string;
  clientId: string;
  year: number;
  month: number;
  publishedBy: string;
  publisherName: string | null;
  publishedAt: Date;
  noteForOwner: string | null;
  snapshotVersion: number;
  snapshotHash: string;
  /** True iff the journal touched this period after publishedAt. Stored as a
   *  column, not computed on read. */
  stale: boolean;
}

export interface PublishedPeriodView extends PublishedPeriodSummary {
  snapshot: OwnerSnapshot;
}

export interface PublishPeriodInput {
  clientId: string;
  year: number;
  month: number;
  publishedBy: string;
  noteForOwner?: string | null;
}

export interface UnpublishPeriodInput {
  clientId: string;
  year: number;
  month: number;
}
