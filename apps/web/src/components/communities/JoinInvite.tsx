"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Spec 017 FR-020 — invite redemption island. Previews the invite (community +
 * space name) without consuming it, then redeems on click and routes the user
 * into the space they were invited to.
 */

type Preview = {
  kind: "community" | "space";
  communityid: string;
  communityname: string;
  spaceid: string | null;
  spacename: string | null;
  expiresat: string;
  valid: boolean;
};

const REDEEM_ERRORS: Record<string, string> = {
  invalid_invite: "This invite link is invalid.",
  invite_used: "This invite link has already been used.",
  invite_expired: "This invite link has expired.",
};

const card = "w-full rounded-xl border border-border bg-card p-6 text-center shadow-sm";
const btn =
  "inline-flex min-h-[40px] w-full items-center justify-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50";

export function JoinInvite({ token }: { token: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`/api/invites/${encodeURIComponent(token)}`, { credentials: "include" });
        if (!active) return;
        if (!r.ok) {
          setError("This invite link is invalid.");
          return;
        }
        setPreview((await r.json()).preview as Preview);
      } catch {
        if (active) setError("Could not load this invite. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const r = await fetch("/api/invites/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        error?: string;
        communityid?: string;
        spaceid?: string | null;
      };
      if (!r.ok) {
        setError(REDEEM_ERRORS[data.error ?? ""] ?? "Could not join. Please try again.");
        setJoining(false);
        return;
      }
      window.dispatchEvent(new CustomEvent("nav:refresh"));
      const dest = data.spaceid
        ? `/communities?c=${data.communityid}&space=${data.spaceid}`
        : `/communities?c=${data.communityid}`;
      router.replace(dest);
    } catch {
      setError("Could not join. Please try again.");
      setJoining(false);
    }
  }, [token, router]);

  if (loading) {
    return <div className={card}><p className="text-sm text-muted-foreground">Loading invite…</p></div>;
  }

  if (error && !preview) {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold">Invite unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <a href="/communities" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Go to Communities
        </a>
      </div>
    );
  }

  if (preview && !preview.valid) {
    return (
      <div className={card}>
        <h1 className="text-lg font-semibold">Invite expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite to {preview.spacename ? <strong>{preview.spacename}</strong> : <strong>{preview.communityname}</strong>} has
          expired or was already used. Ask an admin for a fresh link.
        </p>
        <a href="/communities" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Go to Communities
        </a>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className={card}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You&rsquo;re invited</p>
      <h1 className="mt-2 text-xl font-bold">
        {preview.kind === "space" ? preview.spacename : preview.communityname}
      </h1>
      {preview.kind === "space" && (
        <p className="mt-1 text-sm text-muted-foreground">
          in <strong>{preview.communityname}</strong>
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      <button type="button" onClick={join} disabled={joining} className={`${btn} mt-5`}>
        {joining ? "Joining…" : preview.kind === "space" ? "Join space" : "Join community"}
      </button>
    </div>
  );
}
