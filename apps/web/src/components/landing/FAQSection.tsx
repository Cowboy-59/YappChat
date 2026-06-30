import type { FaqItem } from "@/lib/landing/config-schema";
import { ChevronDown } from "lucide-react";
import { FaqDeepLink } from "./FaqDeepLink";

/**
 * Spec 012 T006 — FAQ (FR-015).
 * Native <details name="faq"> gives one-at-a-time expansion with no JS and keeps
 * every answer in the static HTML (crawler-visible). Initially collapsed.
 * Deep-link /#faq-<id> opens that item (FaqDeepLink client enhancer).
 * Section omitted entirely when there are no FAQs.
 */
export function FAQSection({ faq }: { faq: FaqItem[] }) {
  if (faq.length === 0) return null;

  return (
    <section
      id="faq"
      className="scroll-mt-24 px-6 py-20 sm:py-24"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <h2
          id="faq-heading"
          className="text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Frequently asked questions
        </h2>

        <div className="mt-12 divide-y divide-border rounded-xl border border-border">
          {faq.map((item) => (
            <details
              key={item.id}
              id={`faq-${item.id}`}
              name="faq"
              data-analytics="faq"
              data-faq-id={item.id}
              className="group scroll-mt-24 px-6"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  aria-hidden
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
      <FaqDeepLink />
    </section>
  );
}
