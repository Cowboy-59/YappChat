import type { Branding } from "@/lib/landing/config-schema";

/**
 * Spec 012 T002 — Hero (FR-002).
 * Logo, headline + sub-headline from branding, primary "Get started" CTA to
 * /signup (no plan param) and a secondary "Sign in" link to /signin.
 * Renders fully in static HTML (Server Component, no JS required).
 */
export function Hero({ branding }: { branding: Branding }) {
  return (
    <section
      id="hero"
      className="px-6 py-20 sm:py-28 lg:py-32"
      aria-labelledby="hero-heading"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        {/* Brand logo, top-center. Theme-aware: the dark variant recolours the
            wordmark to light so it reads on the dark surface. */}
        {/* eslint-disable @next/next/no-img-element -- static brand asset, intrinsic transparency */}
        <img
          src="/brand/yappchatlogo-trim.png"
          alt={`${branding.companyname} logo`}
          className="mb-8 h-16 w-auto sm:h-20 dark:hidden"
        />
        <img
          src="/brand/yappchatlogo-trim-dark.png"
          alt={`${branding.companyname} logo`}
          aria-hidden
          className="mb-8 hidden h-16 w-auto sm:h-20 dark:block"
        />
        {/* eslint-enable @next/next/no-img-element */}

        <h1
          id="hero-heading"
          className="max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
        >
          {branding.heroheadline}
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          {branding.herosubheadline}
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href="/signup"
            data-analytics="hero_cta"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-7 text-base font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Get started
          </a>
          <a
            href="/signin"
            data-analytics="signin"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-7 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Sign in
          </a>
        </div>
      </div>
    </section>
  );
}
