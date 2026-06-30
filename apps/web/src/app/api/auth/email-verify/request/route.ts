import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { requestEmailVerification } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/email-verify/request — resend verification to the current user. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await requestEmailVerification(user.id, user.email);
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
