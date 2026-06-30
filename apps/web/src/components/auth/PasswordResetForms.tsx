"use client";

import { useState } from "react";
import Link from "next/link";
import { authMessage } from "./messages";
import {
  AuthCard,
  errorClass,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "./AuthCard";

/** Request a password-reset link. Always shows success (no enumeration). */
export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a reset link if an account exists."
      footer={
        <Link href="/signin" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>,
          a reset link is on its way. Check your inbox.
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
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

/** Consume a reset token (from ?token=) and set a new password. */
export function PasswordResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password-reset/consume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        window.location.assign("/signin?reset=1");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(authMessage(data.error));
    } catch {
      setError(authMessage("internal_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Choose a new password">
      {!token ? (
        <p className={errorClass}>This reset link is missing its token.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? <p className={errorClass}>{error}</p> : null}
          <div>
            <label className={labelClass} htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <button type="submit" className={primaryBtnClass} disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
