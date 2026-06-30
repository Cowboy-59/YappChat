import type { MetadataRoute } from "next";
import { getPublicConfig } from "@/lib/landing/service";
import { getSiteUrl } from "@/lib/site";

// Dynamic so it reflects runtime SITE_URL and the latest disallowindexing
// without waiting for a rebuild/revalidation.
export const dynamic = "force-dynamic";

/**
 * Spec 012 T005 — robots.txt (FR-011).
 * Defaults to Allow: /. Switches to Disallow: / when the deployment opts out of
 * indexing (seo.disallowindexing).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { config } = await getPublicConfig();
  const siteUrl = getSiteUrl();

  if (config.seo.disallowindexing) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
