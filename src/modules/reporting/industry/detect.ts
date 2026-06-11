import type { IndustryId, IndustryResolution } from "./types";
import { industryFromCaen } from "./caen-map";

export interface ClientIndustryFields {
  industry: string | null;
  industrySource: string | null;
  caen: string | null;
}

const VALID_IDS: ReadonlySet<string> = new Set([
  "consultanta",
  "retail",
  "telecom",
  "banking",
  "servicii_contabile",
  "general",
]);

export function isIndustryId(v: string | null | undefined): v is IndustryId {
  return v !== null && v !== undefined && VALID_IDS.has(v);
}

/**
 * Resolves the effective industry for a client:
 *   1. manual selection always wins
 *   2. stored auto-detection wins over re-deriving (stable across renames
 *      of the map)
 *   3. live CAEN-based detection
 *   4. fallback "general"
 */
export function resolveIndustry(client: ClientIndustryFields): {
  id: IndustryId;
  source: IndustryResolution;
} {
  if (client.industrySource === "manual" && isIndustryId(client.industry)) {
    return { id: client.industry, source: "manual" };
  }
  if (isIndustryId(client.industry)) {
    return { id: client.industry, source: "auto" };
  }
  const detected = industryFromCaen(client.caen);
  if (detected) return { id: detected, source: "auto" };
  return { id: "general", source: "default" };
}
