import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { authErrorResponse, readJson } from "@/lib/auth/http";
import { consumePasswordReset } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/password-reset/consume — set new password, revoke all sessions. */
export async function POST(req: Request) {
  const body = await readJson<{ token?: string; password?: string }>(req);
  if (!body?.token || !body?.password) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    await consumePasswordReset(body.token, body.password, { ip: clientIpFrom(req) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
