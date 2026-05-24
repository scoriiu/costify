/**
 * Central registry of in-app documentation links surfaced from the UI.
 *
 * All routes resolve to `/docs/<slug>` served by the existing in-app docs
 * viewer (see `src/app/(dashboard)/docs/[slug]/page.tsx`). Slugs and titles
 * for these pages live in `src/lib/docs-navigation.ts`.
 */

export const DocsLinks = {
  cashflowHome: "/docs/cashflow-introducere",
  mappingLanguage: "/docs/cashflow-limbajul-mapari",

  forAccountant: "/docs/cashflow-pentru-contabil",
  forOwner: "/docs/cashflow-pentru-antreprenor",
  exampleQhm21: "/docs/cashflow-exemplu-qhm21",

  categories: "/docs/cashflow-categorii",
  verticals: "/docs/cashflow-verticale",
} as const;

export type DocsLinkKey = keyof typeof DocsLinks;
