// Service-layer functions are server-only (no "use server" directive). Import
// from "@/modules/partner-mappings" inside server code (loaders, jobs).
export {
  listOverridesForClient,
  listOverridesForCont,
  upsertOverride,
  confirmOverride,
  deleteOverride,
  bulkApplyOverrides,
} from "./service";

// Loader-layer functions wrap the pure aggregator with Prisma queries.
// Used by the Mapari Cashflow loader and the slide-panel on-demand fetch.
export {
  loadPartnersForCont,
  loadPartnerSummariesForClient,
  loadSuggestionQueue,
  loadAllExceptions,
  type SuggestionQueueItem,
  type AllExceptionsRow,
} from "./loader";

export {
  aggregatePartnersForCont,
  summarizePartnersForCont,
  computePartnerCategoryAdjustments,
  type ContKind,
  type JournalLineForAggregation,
  type PartnerAggregationResult,
  type PartnerSummary,
  type PartnerCategoryAdjustment,
} from "./aggregator";

// Actions are server actions ("use server"). Import via the
// "@/modules/partner-mappings/actions" subpath from client components so
// Next.js can keep the boundary clear.

export type {
  PartnerCategoryOverrideRow,
  PartnerOverrideSource,
  PartnerEntry,
} from "./types";
