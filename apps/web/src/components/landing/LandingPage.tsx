import type { PublicLandingConfig } from "@/lib/landing/config-schema";
import { Hero } from "./Hero";
import { FeaturesSection } from "./FeaturesSection";
import { SecurityCallout } from "./SecurityCallout";
import { PricingSection } from "./PricingSection";
import { FAQSection } from "./FAQSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { Footer } from "./Footer";

/**
 * Spec 012 T001 — root composition of the public landing page.
 * Server Component: all content renders in the static HTML response.
 *
 * Auth redirect (T007) and analytics (T008) mount as client components from
 * page.tsx so they run after first paint without blocking it.
 */
export function LandingPage({ config }: { config: PublicLandingConfig }) {
  return (
    <>
      <main className="flex-1">
        <Hero branding={config.branding} />
        <FeaturesSection features={config.features} />
        <SecurityCallout security={config.security} />
        <PricingSection plans={config.plans} />
        <TestimonialsSection testimonials={config.testimonials} />
        <FAQSection faq={config.faq} />
      </main>
      <Footer config={config} />
    </>
  );
}
