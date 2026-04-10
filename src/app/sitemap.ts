import type { MetadataRoute } from "next";
import { DOC_NAVIGATION } from "@/lib/docs-navigation";
import { SITE_URL } from "@/lib/seo";

/**
 * Docs are currently behind auth. When they become public, flip this
 * flag to true and Google will start indexing every article via the
 * sitemap. Also requires removing /docs from the disallow list in
 * src/app/robots.ts and flipping the per-doc metadata in
 * src/app/(dashboard)/docs/[slug]/page.tsx.
 */
const DOCS_PUBLIC = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];

  if (!DOCS_PUBLIC) {
    return staticRoutes;
  }

  const docsIndex: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const docRoutes: MetadataRoute.Sitemap = DOC_NAVIGATION.flatMap((category) =>
    category.pages.map((page) => ({
      url: `${SITE_URL}/docs/${page.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }))
  );

  return [...staticRoutes, ...docsIndex, ...docRoutes];
}
