import { Check } from "lucide-react";
import type { Plan } from "@/lib/landing/config-schema";

/**
 * Spec 012 T003 — PricingCard (FR-005, FR-006).
 * Display price, billing interval, feature list, and a per-plan CTA whose href
 * comes from config (`/signup?plan=<id>`) so the plan param reaches spec 011's
 * signup form.
 */
export function PricingCard({ plan }: { plan: Plan }) {
  return (
    <article
      className={[
        "flex flex-col rounded-2xl border bg-card p-8 text-card-foreground shadow-sm",
        plan.highlighted ? "border-primary ring-1 ring-primary" : "border-border",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
        {plan.highlighted ? (
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Most popular
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tracking-tight text-foreground">
          {plan.displayprice}
        </span>
        <span className="text-sm text-muted-foreground">{plan.billinginterval}</span>
      </div>

      <ul className="mt-8 flex-1 space-y-3">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={plan.ctapath}
        data-analytics="plan_cta"
        data-plan={plan.id}
        className={[
          "mt-8 inline-flex min-h-[44px] items-center justify-center rounded-lg px-6 text-base font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          plan.highlighted
            ? "bg-primary text-primary-foreground"
            : "border border-border text-foreground hover:bg-muted",
        ].join(" ")}
      >
        {plan.ctalabel}
      </a>
    </article>
  );
}
