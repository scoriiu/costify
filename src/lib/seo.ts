/**
 * Centralized SEO constants. Single source of truth for site URL,
 * brand name, default descriptions, and locale.
 *
 * Used by:
 * - src/app/layout.tsx (root metadata)
 * - src/app/sitemap.ts
 * - src/app/robots.ts
 * - src/app/opengraph-image.tsx
 * - per-page generateMetadata exports
 */

export const SITE_URL = "https://costify.ro" as const;
export const SITE_NAME = "Costify" as const;
export const SITE_LOCALE = "ro_RO" as const;

export const SITE_DESCRIPTION =
  "Costify este platforma de control financiar pentru contabili si manageri financiari din Romania. Importa jurnalul din Saga, SmartBill sau Ciel si vezi balanta de verificare, cont de profit si pierdere si KPI-urile calculate in timp real. Costi, asistentul AI, stie contabilitatea romaneasca pe dinafara." as const;

export const SITE_DESCRIPTION_SHORT =
  "Control financiar pentru contabili. Importa jurnalul din software-ul tau contabil, vezi balanta, CPP si KPI in timp real." as const;

export const SITE_KEYWORDS = [
  "contabilitate romaneasca",
  "software contabil",
  "balanta de verificare",
  "cont profit si pierdere",
  "OMFP 1802",
  "import jurnal Saga",
  "SmartBill",
  "Ciel",
  "control financiar",
  "KPI contabilitate",
  "TVA de plata",
  "Costify",
] as const;

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${SITE_URL}${path}`;
  return `${SITE_URL}/${path}`;
}

export function pageTitle(title: string): string {
  return `${title} · ${SITE_NAME}`;
}
