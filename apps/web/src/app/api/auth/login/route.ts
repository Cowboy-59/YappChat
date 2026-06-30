import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { authErrorResponse, readJson } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/ratelimit";
import { login } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/login — email+password (FR-002). */
export async function POST(req: Request) {
  const ip = clientIpFrom(req);
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Rate limit per (IP + email): 5 attempts / 15 min.
  const key = `login:${ip ?? "unknown"}:${body.email.toLowerCase()}`;
  const limit = rateLimit(key, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  try {
    const result = await login(body.email, body.password, { ip });
    return NextResponse.json(result);
  } catch (err) {
    return authErrorResponse(err);
  }
}
