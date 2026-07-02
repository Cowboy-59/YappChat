import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { consumeEmailVerification } from "@/lib/auth/service";
import { autoAcceptContactInvitesForUser } from "@/lib/contacts/service";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** GET /api/auth/email-verify/:token — consume a verification link, then redirect. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const { userid } = await consumeEmailVerification(token, { ip: clientIpFrom(req) });
    // FR-024 — email is now verified: auto-accept any pending invites addressed to
    // it (and notify the inviters). Best-effort; never blocks the redirect.
    await autoAcceptContactInvitesForUser(userid).catch(() => {});
    return NextResponse.redirect(`${getSiteUrl()}/?verified=1`);
  } catch {
    return NextResponse.redirect(`${getSiteUrl()}/?verified=0`);
  }
}
