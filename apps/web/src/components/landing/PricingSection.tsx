import type { Plan } from "@/lib/landing/config-schema";
import { PricingCard } from "./PricingCard";

/**
 * Spec 012 T003 — PricingSection (FR-005, FR-006).
 * Cards side-by-side at ≥640px, stacked below. Plan content (price, headline,
 * features, CTA path) comes entirely from `landingpageconfig.plans`.
 */
export function PricingSection({ plans }: { plans: Plan[] }) {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 bg-surface px-6 py-20 sm:py-24"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="pricing-heading"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Simple, honest pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One price. Every feature. Billed yearly.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  );
}
