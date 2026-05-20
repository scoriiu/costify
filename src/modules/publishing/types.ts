import type { OwnerSnapshot } from "@/modules/reporting/owner";

/** Current snapshot schema version. Bump when OwnerSnapshot's shape changes. */
export const SNAPSHOT_VERSION = 1;

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
