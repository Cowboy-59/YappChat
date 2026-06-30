/**
 * Spec 012 T008 — analytics events (FR-014).
 *
 * Events are pushed to `window.dataLayer` ONLY. No third-party tracker
 * (gtag/segment/etc.) is bundled — deployments attach their analytics of choice
 * via an external <script> they manage. See analytics-events.md for the
 * authoritative payload reference.
 */

export type LandingEvent =
  | { event: "landing.viewed" }
  | { event: "landing.hero_cta_clicked" }
  | { event: "landing.plan_cta_clicked"; plan: string }
  | { event: "landing.signin_clicked" }
  | { event: "landing.faq_expanded"; faqId: string }
  | { event: "landing.scroll_depth"; depthPercent: 25 | 50 | 75 | 100 };

declare global {
  interface Window {
    dataLayer?: LandingEvent[];
  }
}

/** Push a typed event onto window.dataLayer, initialising it if needed. */
export function pushEvent(payload: LandingEvent): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payload);
}
