import { redirect } from "next/navigation";
import { JoinInvite } from "@/components/communities/JoinInvite";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Spec 017 FR-020 — invite redemption landing page. A recipient opens
 * `/communities/join?token=…` (community or per-space invite), sees a preview,
 * and joins on click. Unauthenticated visitors are bounced to sign-in and
 * returned here with the token intact (the path is allow-listed in return-url.ts).
 */
export default async function CommunityJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Invalid invite link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is missing its invite token.</p>
      </main>
    );
  }

  const user = await getSessionUser();
  if (!user) redirect(`/signin?return=${encodeURIComponent(`/communities/join?token=${token}`)}`);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
      <JoinInvite token={token} />
    </main>
  );
}
