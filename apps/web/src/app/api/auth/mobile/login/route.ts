import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { authErrorResponse, readJson } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/ratelimit";
import { loginMobile } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/mobile/login — email+password sign-in for native apps (spec 008).
 * Returns `{ user, org, token }`; the app stores `token` in expo-secure-store and
 * sends it as `Authorization: Bearer <token>` on subsequent requests. Same rate
 * limit as the web login (5 / 15 min per IP+email).
 */
export async function POST(req: Request) {
  const ip = clientIpFrom(req);
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const key = `login:${ip ?? "unknown"}:${body.email.toLowerCase()}`;
  const limit = rateLimit(key, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  try {
    const result = await loginMobile(body.email, body.password, { ip });
    return NextResponse.json(result);
  } catch (err) {
    return authErrorResponse(err);
  }
}
