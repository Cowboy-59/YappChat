import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { mintWsToken } from "@/lib/ws/token";

export const dynamic = "force-dynamic";

/**
 * GET /api/ws/token — issue a short-lived WS handshake token for the signed-in
 * user. Called same-origin (session cookie), so the browser can then authenticate
 * to the WS engine cross-domain by passing this token in the handshake URL.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ token: mintWsToken(user.id), expiresInMs: 60_000 });
}
