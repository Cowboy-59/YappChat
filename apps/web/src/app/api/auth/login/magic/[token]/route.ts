import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { consumeMagicLink } from "@/lib/auth/service";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** GET /api/auth/login/magic/:token — consume link, set session, redirect to app. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    await consumeMagicLink(token, { ip: clientIpFrom(req) });
    return NextResponse.redirect(`${getSiteUrl()}/app`);
  } catch {
    // Expired/replayed/invalid -> back to sign-in with a flag.
    return NextResponse.redirect(`${getSiteUrl()}/signin?magic=invalid`);
  }
}
