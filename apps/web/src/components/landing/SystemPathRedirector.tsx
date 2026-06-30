"use client";

import { useEffect } from "react";
import { resolveReturnPath } from "@/lib/auth/return-url";

/**
 * Spec 012 T007 — role-aware auto-redirect for authenticated sessions
 * (FR-007, FR-018).
 *
 * Mounts AFTER first paint (useEffect) so new/unauthenticated visitors are never
 * blocked and see no spinner. Calls spec 011's `GET /api/auth/me` once:
 *   - 200 + any system flag (issystemadmin/isbillingadmin/issupport) -> /admin
 *   - 200 + no system flag                                           -> /app
 *   - 401 / missing endpoint / network error                        -> stay
 *
 * A `?return=<path>` is honoured only when it passes the allow-list
 * (resolveReturnPath); otherwise the role default is used.
 *
 * Renders nothing.
 */
export function SystemPathRedirector() {
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) return; // 401 / 404 / etc -> stay on the landing page

        const user = (await res.json()) as {
          issystemadmin?: boolean;
          isbillingadmin?: boolean;
          issupport?: boolean;
        };
        const isSystemStaff = Boolean(
          user.issystemadmin || user.isbillingadmin || user.issupport,
        );

        const returnParam = new URLSearchParams(window.location.search).get(
          "return",
        );
        const dest = resolveReturnPath(returnParam, { isSystemStaff });
        window.location.replace(dest);
      } catch {
        // Network error or aborted -> stay; first paint is never blocked.
      }
    })();

    return () => controller.abort();
  }, []);

  return null;
}
