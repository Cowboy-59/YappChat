"use client";

import { useEffect } from "react";
import { pushEvent } from "@/lib/analytics/events";

/**
 * Spec 012 T008 — emits landing analytics into window.dataLayer (FR-014).
 *
 * Uses event delegation so the server-rendered links/sections stay in static
 * HTML: elements opt in with `data-analytics="<type>"` and optional
 * `data-plan` / `data-faq-id`. Fires landing.viewed on mount and scroll-depth
 * milestones at 25/50/75/100%. Renders nothing.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    pushEvent({ event: "landing.viewed" });

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-analytics]");
      if (!el) return;
      switch (el.dataset.analytics) {
        case "hero_cta":
          pushEvent({ event: "landing.hero_cta_clicked" });
          break;
        case "plan_cta":
          pushEvent({
            event: "landing.plan_cta_clicked",
            plan: el.dataset.plan ?? "unknown",
          });
          break;
        case "signin":
          pushEvent({ event: "landing.signin_clicked" });
          break;
      }
    }

    // FAQ <details> opening — capture phase catches the native toggle event.
    function onToggle(e: Event) {
      const el = e.target as HTMLElement | null;
      if (
        el instanceof HTMLDetailsElement &&
        el.dataset.analytics === "faq" &&
        el.open
      ) {
        pushEvent({
          event: "landing.faq_expanded",
          faqId: el.dataset.faqId ?? "unknown",
        });
      }
    }

    const milestones: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
    const fired = new Set<number>();
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const percent = scrollable <= 0 ? 100 : (doc.scrollTop / scrollable) * 100;
      for (const m of milestones) {
        if (percent >= m && !fired.has(m)) {
          fired.add(m);
          pushEvent({ event: "landing.scroll_depth", depthPercent: m });
        }
      }
    }
    onScroll(); // record initial position (short pages -> 100% immediately)

    document.addEventListener("click", onClick);
    document.addEventListener("toggle", onToggle, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
