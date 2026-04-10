import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/clients/",
          "/internal/",
          "/debug/",
          "/admin/",
          "/login",
          "/settings/",
          // Docs are currently behind auth. TODO: remove these two lines
          // when docs become public so search engines can index them.
          "/docs",
          "/docs/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
