import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { StructuredData } from "@/components/landing/StructuredData";
import { SystemPathRedirector } from "@/components/landing/SystemPathRedirector";
import { AnalyticsProvider } from "@/components/landing/AnalyticsProvider";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { Splash } from "@/components/landing/Splash";
import { getPublicConfig } from "@/lib/landing/service";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/site";

/**
 * Spec 012 T001 — public landing page at `/`.
 *
 * Statically prerendered with ISR: the page revalidates every 60s so an admin
 * config save is reflected within 60s (FR-008) without per-request SSR blocking
 * first paint. Config is read in this Server Component; no Request-time APIs are
 * used, so the route prerenders.
 */
export const revalidate = 60;

/** T005 — full <head> metadata, OG/Twitter (FR-009). */
export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getPublicConfig();
  const { seo, branding } = config;
  const siteUrl = getSiteUrl();
  const canonical = seo.canonicalurl ? toAbsoluteUrl(seo.canonicalurl) : siteUrl;
  const ogImage = seo.ogimageurl ? toAbsoluteUrl(seo.ogimageurl) : undefined;

  return {
    metadataBase: new URL(siteUrl),
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical },
    robots: seo.disallowindexing
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: branding.companyname,
      title: seo.title,
      description: seo.description,
      url: canonical,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      ...(seo.twitterhandle ? { site: seo.twitterhandle } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function Page() {
  const { config } = await getPublicConfig();
  return (
    <>
      <StructuredData config={config} />
      {/* Client-only, mount after first paint — never block initial render. */}
      <SystemPathRedirector />
      <AnalyticsProvider />
      <ThemeToggle className="fixed top-4 right-4 z-50" />
      <LandingPage config={config} />
      <Splash />
    </>
  );
}
