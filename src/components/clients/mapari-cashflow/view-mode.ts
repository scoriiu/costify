/**
 * The primary Mapari Cashflow view mode, shared between the sticky period
 * dock (which renders the switcher, always visible) and CategoryWorkspace
 * (which renders the matching body). Single source of truth for order,
 * labels, icons and URL slugs so the two sides never drift.
 */

import { List, LayoutGrid, Columns3, type LucideIcon } from "lucide-react";

export type ViewMode = "list" | "treemap" | "verticals";

// Ordered by increasing aggregation: raw list -> visual map -> rolled up
// into business lines.
export const VIEW_OPTIONS: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "list", label: "Linii de cost", icon: List },
  { value: "treemap", label: "Harta de cost", icon: LayoutGrid },
  { value: "verticals", label: "Linii de business", icon: Columns3 },
];

// URL slugs kept friendly/stable so deep links read well (?cashflow-view=harta).
const VIEW_PARAM = "cashflow-view";
const VIEW_TO_SLUG: Record<ViewMode, string> = {
  list: "list",
  treemap: "harta",
  verticals: "linii",
};
const SLUG_TO_VIEW: Record<string, ViewMode> = {
  list: "list",
  harta: "treemap",
  linii: "verticals",
};

export function readViewFromUrl(): ViewMode {
  if (typeof window === "undefined") return "list";
  const params = new URLSearchParams(window.location.search);
  const slug = params.get(VIEW_PARAM);
  if (slug && SLUG_TO_VIEW[slug]) return SLUG_TO_VIEW[slug];
  // Legacy deep-links from the old two-tab layout (?cashflow-tab=verticale)
  // land on the equivalent view instead of silently falling back to the list.
  if (params.get("cashflow-tab") === "verticale") return "verticals";
  return "list";
}

export function writeViewToUrl(view: ViewMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (view === "list") url.searchParams.delete(VIEW_PARAM);
  else url.searchParams.set(VIEW_PARAM, VIEW_TO_SLUG[view]);
  window.history.replaceState(window.history.state, "", url.toString());
}
