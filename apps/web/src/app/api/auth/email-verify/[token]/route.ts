import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { consumeEmailVerification } from "@/lib/auth/service";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** GET /api/auth/email-verify/:token — consume a verification link, then redirect. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    await consumeEmailVerification(token, { ip: clientIpFrom(req) });
    return NextResponse.redirect(`${getSiteUrl()}/?verified=1`);
  } catch {
    return NextResponse.redirect(`${getSiteUrl()}/?verified=0`);
  }
}
