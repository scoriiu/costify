/**
 * Central registry of documentation links surfaced from the UI.
 *
 * For now we link directly to the GitHub blob view of the markdown files in
 * `docs/cashflow/`. When we ship an in-app `/docs` viewer, only the base
 * needs to change here — all call sites stay the same.
 */

const REPO_BASE = "https://github.com/scoriiu/costify/blob/main";

export const DocsLinks = {
  cashflowHome: `${REPO_BASE}/docs/cashflow/README.md`,

  forAccountant: `${REPO_BASE}/docs/cashflow/pentru-contabil.md`,
  forOwner: `${REPO_BASE}/docs/cashflow/pentru-antreprenor.md`,
  exampleQhm21: `${REPO_BASE}/docs/cashflow/exemplu-qhm21.md`,

  categories: `${REPO_BASE}/docs/cashflow/concepte/categorii.md`,
  verticals: `${REPO_BASE}/docs/cashflow/concepte/verticale.md`,
} as const;

export type DocsLinkKey = keyof typeof DocsLinks;
