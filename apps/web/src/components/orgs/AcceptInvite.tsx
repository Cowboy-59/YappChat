"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ERRORS: Record<string, string> = {
  invite_invalid_or_expired: "This invite link is invalid or has expired.",
  invite_email_mismatch: "This invite was sent to a different email address. Sign in with that email to accept.",
  seat_limit_reached: "This workspace has no available seats. Ask an admin to free one up.",
};

/** Shown when the signed-in account's email doesn't match the invite. Lets the
 *  user sign out and continue as the invited address. */
export function InviteWrongAccount({
  token,
  invitedEmail,
  currentEmail,
}: {
  token: string;
  invitedEmail: string;
  currentEmail: string;
}) {
  const [busy, setBusy] = useState(false);
  async function switchAccount() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // Logged out → the invite page re-routes to sign-up/in for the invited email.
    window.location.assign(`/invite/${token}`);
  }
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
      <h1 className="text-lg font-bold">Workspace invitation</h1>
      <p className="text-sm text-muted-foreground">
        This invitation is for <span className="font-semibold text-foreground">{invitedEmail}</span>, but you&apos;re signed in as{" "}
        <span className="font-semibold text-foreground">{currentEmail}</span>.
      </p>
      <button
        onClick={switchAccount}
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Signing out…" : `Sign out & continue as ${invitedEmail}`}
      </button>
      <Link href="/app" className="block text-xs text-muted-foreground hover:text-foreground">
        Stay signed in as {currentEmail}
      </Link>
    </div>
  );
}

export function AcceptInvite({ token }: { token: string }) {
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [msg, setMsg] = useState("Accepting your invitation…");

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/orgs/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        setState("ok");
        setMsg("You've joined the workspace 🎉");
      } else {
        setState("error");
        setMsg(ERRORS[data.error ?? ""] ?? "Could not accept this invitation.");
      }
    })();
  }, [token]);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
      <h1 className="text-lg font-bold">Workspace invitation</h1>
      <p className={`text-sm ${state === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{msg}</p>
      {state === "ok" && (
        <Link href="/app" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Go to dashboard
        </Link>
      )}
      {state === "error" && (
        <Link href="/app" className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
          Back to dashboard
        </Link>
      )}
    </div>
  );
}
