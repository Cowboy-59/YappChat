import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getInvitePreview } from "@/lib/orgs/service";
import { AcceptInvite, InviteWrongAccount } from "@/components/orgs/AcceptInvite";

export const dynamic = "force-dynamic";

/**
 * Org invitation landing.
 *  - Signed in as the invited email → accept.
 *  - Signed in as a DIFFERENT account → offer to switch (don't silently accept as
 *    the wrong user — the email-match check would fail anyway).
 *  - Not signed in → existing account → sign in; new → sign up (email pre-filled).
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [user, preview] = await Promise.all([getSessionUser(), getInvitePreview(token)]);

  if (!preview.valid || !preview.email) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-bold">Workspace invitation</h1>
          <p className="text-sm text-red-600 dark:text-red-400">This invitation is invalid or has expired.</p>
          <Link href="/signin" className="inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (user) {
    const match = user.email.toLowerCase() === preview.email.toLowerCase();
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        {match ? (
          <AcceptInvite token={token} />
        ) : (
          <InviteWrongAccount token={token} invitedEmail={preview.email} currentEmail={user.email} />
        )}
      </main>
    );
  }

  // Not signed in: existing account → sign in; brand-new → sign up (email locked).
  const qs = new URLSearchParams({ return: `/invite/${token}`, email: preview.email });
  redirect(`${preview.userExists ? "/signin" : "/signup"}?${qs.toString()}`);
}
