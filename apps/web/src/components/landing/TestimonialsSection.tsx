import type { Testimonial } from "@/lib/landing/config-schema";

/**
 * Spec 012 T006 — Testimonials (FR-016).
 * Rendered only when there is at least one testimonial; no "Coming soon"
 * placeholder when the array is empty (section is omitted entirely).
 */
export function TestimonialsSection({
  testimonials,
}: {
  testimonials: Testimonial[];
}) {
  if (testimonials.length === 0) return null;

  return (
    <section
      id="testimonials"
      className="scroll-mt-24 bg-surface px-6 py-20 sm:py-24"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="testimonials-heading"
          className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Loved by teams and individuals
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.id}
              className="flex flex-col rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
            >
              <blockquote className="flex-1 text-base leading-relaxed text-foreground">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                {t.avatarurl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- config-driven avatar
                  <img
                    src={t.avatarurl}
                    alt={t.author}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : null}
                <span className="text-sm">
                  <span className="block font-semibold text-foreground">
                    {t.author}
                  </span>
                  {(t.role || t.company) && (
                    <span className="text-muted-foreground">
                      {[t.role, t.company].filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
