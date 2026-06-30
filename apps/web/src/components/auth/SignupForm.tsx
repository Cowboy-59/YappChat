"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveReturnPath } from "@/lib/auth/return-url";
import { SsoButtons } from "./SsoButtons";
import { authMessage } from "./messages";
import {
  AuthCard,
  errorClass,
  fieldClass,
  labelClass,
  primaryBtnClass,
} from "./AuthCard";
import { passwordStrength } from "@/lib/auth/password-strength";

const STRENGTH_BAR = ["bg-border", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

/** Spec 011 T008 — signup form. Plan comes from spec 012's /signup?plan=… link. */
export function SignupForm({
  plan,
  returnTo,
  invitedEmail,
  ssoProviders = [],
}: {
  plan: "individual" | "corporate";
  returnTo?: string;
  /** When arriving from a workspace invite, the email is fixed (accept must match). */
  invitedEmail?: string;
  ssoProviders?: { key: string; label: string }[];
}) {
  const [displayname, setDisplayname] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [orgname, setOrgname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCorporate = plan === "corporate";
  const strength = passwordStrength(password);
  const tooWeak = password.length > 0 && strength.score < 2;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayname, email, password, plan, orgname }),
      });
      if (res.status === 201) {
        window.location.assign(resolveReturnPath(returnTo, { isSystemStaff: false }));
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
      title="Create your account"
      subtitle={`${isCorporate ? "Corporate" : "Individual"} plan`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <p className={errorClass}>{error}</p> : null}
        <div>
          <label className={labelClass} htmlFor="displayname">
            Name
          </label>
          <input
            id="displayname"
            className={fieldClass}
            value={displayname}
            onChange={(e) => setDisplayname(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        {isCorporate ? (
          <div>
            <label className={labelClass} htmlFor="orgname">
              Organisation name
            </label>
            <input
              id="orgname"
              className={fieldClass}
              value={orgname}
              onChange={(e) => setOrgname(e.target.value)}
              required
            />
          </div>
        ) : null}
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
            readOnly={Boolean(invitedEmail)}
          />
          {invitedEmail ? (
            <p className="mt-1 text-xs text-muted-foreground">You were invited as {invitedEmail}.</p>
          ) : null}
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            Password
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
          {password ? (
            <div className="mt-2">
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < strength.score ? STRENGTH_BAR[strength.score] : "bg-border"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Strength: {strength.label}
                {tooWeak ? " — add length or a mix of letters, numbers, and symbols." : ""}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          )}
        </div>
        <button type="submit" className={primaryBtnClass} disabled={busy || tooWeak}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <SsoButtons providers={ssoProviders} returnTo={returnTo} />
      </form>
    </AuthCard>
  );
}
