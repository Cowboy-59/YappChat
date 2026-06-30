import { ArrowRight } from "lucide-react";
import type { Feature } from "@/lib/landing/config-schema";
import { FeatureIcon } from "./icons";

/**
 * Spec 012 T002 — FeatureCard (FR-003).
 * Icon, headline, one-sentence body, a deep-link anchor id (e.g. #feature-pa),
 * and an optional per-card CTA (e.g. the self-host download → corporate signup).
 */
export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <article
      id={feature.id}
      className="flex scroll-mt-24 flex-col rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
    >
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-primary">
        <FeatureIcon name={feature.icon} className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{feature.headline}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {feature.body}
      </p>
      {feature.cta ? (
        <a
          href={feature.cta.href}
          data-analytics="plan_cta"
          className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {feature.cta.label}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </a>
      ) : null}
    </article>
  );
}
