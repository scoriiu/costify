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

// Actions are server actions ("use server"). Import via the
// "@/modules/partner-mappings/actions" subpath from client components so
// Next.js can keep the boundary clear.

export type {
  PartnerCategoryOverrideRow,
  PartnerOverrideSource,
  PartnerEntry,
} from "./types";
