"use client";

import { useState } from "react";
import Link from "next/link";
import { isSystemStaff } from "@/lib/auth/shared";
import { resolveReturnPath } from "@/lib/auth/return-url";
import { SsoButtons } from "./SsoButtons";
import { authMessage, ssoMessage } from "./messages";
import {
  AuthCard,
  errorClass,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "./AuthCard";

/** Spec 011 T008 — email+password login form. */
export function LoginForm({
  returnTo,
  prefillEmail,
  ssoProviders = [],
  ssoError,
}: {
  returnTo?: string;
  prefillEmail?: string;
  ssoProviders?: { key: string; label: string }[];
  /** `?sso_error=` code from a failed/blocked SSO redirect (e.g. account_exists). */
  ssoError?: string;
}) {
  const ssoNotice = ssoMessage(ssoError);
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          user: { issystemadmin: boolean; isbillingadmin: boolean; issupport: boolean };
        };
        const staff = isSystemStaff(data.user);
        window.location.assign(resolveReturnPath(returnTo, { isSystemStaff: staff }));
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
    <AuthCard
      title="Welcome back"
      footer={
        <>
          New to YappChatt?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {ssoNotice ? (
          <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
            {ssoNotice}
          </p>
        ) : null}
        {error ? <p className={errorClass}>{error}</p> : null}
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
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <Link
              href="/reset-request"
              className="mb-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" className={primaryBtnClass} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="relative py-1 text-center">
          <span className="bg-card px-2 text-xs text-muted-foreground">or</span>
        </div>
        <Link
          href="/signin?method=magic"
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Email me a sign-in link
        </Link>
        <SsoButtons providers={ssoProviders} returnTo={returnTo} />
      </form>
    </AuthCard>
  );
}
