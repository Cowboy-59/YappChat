"use client";

import { useState } from "react";

/** Spec 011 T008 — persistent email-verification banner with a Resend action. */
export function EmailVerifyNotice() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function resend() {
    setState("sending");
    await fetch("/api/auth/email-verify/request", {
      method: "POST",
      credentials: "include",
    });
    setState("sent");
  }

  return (
    <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <span className="text-amber-700 dark:text-amber-400">
        Please verify your email address.
      </span>
      <button
        type="button"
        onClick={resend}
        disabled={state !== "idle"}
        className="shrink-0 font-semibold text-amber-800 underline hover:no-underline disabled:opacity-60 dark:text-amber-300"
      >
        {state === "sent" ? "Sent ✓" : state === "sending" ? "Sending…" : "Resend"}
      </button>
    </div>
  );
}
