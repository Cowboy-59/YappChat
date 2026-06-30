import type { MetadataRoute } from "next";
import { getPublicConfig } from "@/lib/landing/service";
import { getSiteUrl } from "@/lib/site";

// Dynamic so it reflects runtime SITE_URL and the latest config (anchors,
// disallowindexing) without waiting for a rebuild/revalidation.
export const dynamic = "force-dynamic";

/**
 * Spec 012 T005 — sitemap.xml (FR-011).
 * Lists `/` plus feature + FAQ anchor fragments. Returns an empty sitemap when
 * the deployment has opted out of indexing (seo.disallowindexing).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { config, updatedat } = await getPublicConfig();
  if (config.seo.disallowindexing) return [];

  const siteUrl = getSiteUrl();
  const lastModified = updatedat ? new Date(updatedat) : new Date();

  const anchors = [
    "#features",
    "#security",
    "#pricing",
    "#faq",
    ...config.features.map((f) => `#${f.id}`),
    ...config.faq.map((f) => `#faq-${f.id}`),
  ];

  return [
    { url: siteUrl, lastModified, changeFrequency: "weekly", priority: 1 },
    ...anchors.map((anchor) => ({
      url: `${siteUrl}/${anchor}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
