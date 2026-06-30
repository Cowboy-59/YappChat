"use client";

import { useState } from "react";

/** Calls logout, then returns to the landing page. */
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function onClick() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // Spec 008 seam: SecureKeyStore.clearUser(userid) runs here once available.
    window.location.assign("/");
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
