import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/http";
import { AuthError } from "@/lib/auth/service";
import { EngineError } from "@/lib/engine/errors";
import { provisionConsumerSession, verifyConsumerSecret } from "@/lib/consumer/wxkanban";

export const dynamic = "force-dynamic";

/**
 * POST /api/consumer/session — wxKanban Cockpit community-help consumer seam.
 *
 * Called by ONE trusted external app (the wxKanban Dev Cockpit) to provision-or-log
 * in a user by email and drop them into the wxKanban Community's help space. Guarded
 * by the dedicated `WXKANBAN_CONSUMER_SECRET` (NOT a user session): accepted as
 * `Authorization: Bearer <secret>` or the `x-consumer-secret` header, compared in
 * constant time. Returns the RAW opaque session token so the caller can carry the
 * session; the `yc_session` cookie is also set as a side effect.
 */

/** Pull the presented consumer secret from either accepted header form. */
function presentedSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-consumer-secret");
}

export async function POST(req: Request) {
  if (!verifyConsumerSecret(presentedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJson<{ email?: string; displayName?: string }>(req);
  const email = body?.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  try {
    const result = await provisionConsumerSession({ email, displayName: body?.displayName });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError || err instanceof EngineError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    console.error("[consumer/session] unexpected error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
