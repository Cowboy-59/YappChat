import type { PublicLandingConfig } from "@/lib/landing/config-schema";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/site";

/**
 * Spec 012 T005 — JSON-LD structured data (FR-010).
 * Emits inline <script type="application/ld+json"> for schema.org Organization
 * and SoftwareApplication. SoftwareApplication.offers reflects both plans'
 * current prices from config. Rendered server-side so it's in the raw HTML.
 */
export function StructuredData({ config }: { config: PublicLandingConfig }) {
  const siteUrl = getSiteUrl();
  const { branding, seo, plans } = config;

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: branding.companyname,
    url: siteUrl,
    ...(branding.logourl ? { logo: toAbsoluteUrl(branding.logourl) } : {}),
    ...(seo.ogimageurl ? { image: toAbsoluteUrl(seo.ogimageurl) } : {}),
    description: seo.description,
    contactPoint: {
      "@type": "ContactPoint",
      email: branding.contactemail,
      contactType: "customer support",
    },
    sameAs: [branding.githuburl].filter(Boolean),
  };

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: branding.companyname,
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Web, iOS, Android, Windows, macOS",
    url: siteUrl,
    description: seo.description,
    offers: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      // Numeric price extracted from the display string when possible.
      price: extractPrice(plan.displayprice),
      priceCurrency: "USD",
      description: `${plan.displayprice} — ${plan.billinginterval}`,
      url: `${siteUrl}${plan.ctapath}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // schema.org JSON-LD must be inline; content is config-derived, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
    </>
  );
}

function extractPrice(display: string): string {
  const match = display.match(/[\d.]+/);
  return match ? match[0] : "0";
}
