"use client";

import { useEffect } from "react";

/**
 * Spec 012 T006 — opens the FAQ <details> matching the URL hash (/#faq-<id>)
 * and scrolls to it. Progressive enhancement only: the content is already in
 * the static HTML; this just expands the targeted item. No UI of its own.
 */
export function FaqDeepLink() {
  useEffect(() => {
    function openFromHash() {
      const hash = window.location.hash;
      if (!hash.startsWith("#faq-")) return;
      const el = document.getElementById(hash.slice(1));
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
