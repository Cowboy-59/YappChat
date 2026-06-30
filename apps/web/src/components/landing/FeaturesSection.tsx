import type { Feature } from "@/lib/landing/config-schema";
import { FeatureCard } from "./FeatureCard";

/**
 * Spec 012 T002 — FeaturesSection (FR-003).
 * Renders one card per pillar. Responsive grid: 1 col (mobile),
 * 2 col (tablet ≥640px), 3 col (desktop ≥1024px).
 */
export function FeaturesSection({ features }: { features: Feature[] }) {
  return (
    <section
      id="features"
      className="scroll-mt-24 bg-surface px-6 py-20 sm:py-24"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="features-heading"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            Everything in one private app
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Eight pillars that turn scattered tools into a single, private workspace.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
