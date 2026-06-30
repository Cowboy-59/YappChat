"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AuthCard,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "./AuthCard";

/** Spec 011 T003 — passwordless sign-in via emailed magic link. */
export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/login/magic/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true); // always success UI (no enumeration)
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Sign in with a magic link"
      subtitle="We'll email you a one-time sign-in link."
      footer={
        <>
          Prefer a password?{" "}
          <Link href="/signin" className="font-semibold text-primary hover:underline">
            Sign in with password
          </Link>
        </>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account can be created or matched for{" "}
          <span className="font-medium text-foreground">{email}</span>, a sign-in
          link is on its way. It expires in 10 minutes.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            {busy ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
