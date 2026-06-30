import { ShieldCheck } from "lucide-react";
import type { Security } from "@/lib/landing/config-schema";

/**
 * Spec 012 T002 — SecurityCallout (FR-004).
 * Sits between Features and Pricing. Headline + ≥3 bullets; #security deep-links
 * to the section.
 */
export function SecurityCallout({ security }: { security: Security }) {
  return (
    <section
      id="security"
      className="scroll-mt-24 px-6 py-20 sm:py-24"
      aria-labelledby="security-heading"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-8 text-card-foreground sm:p-12">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-accent">
          <ShieldCheck aria-hidden className="h-7 w-7" />
        </div>
        <h2
          id="security-heading"
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {security.headline}
        </h2>
        <ul className="mt-8 space-y-4">
          {security.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-3">
              <ShieldCheck
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 text-accent"
              />
              <span className="text-base leading-relaxed text-muted-foreground">
                {bullet}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
