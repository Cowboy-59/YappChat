import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { authErrorResponse, readJson } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/ratelimit";
import { signup } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/signup — email+password registration (FR-001). */
export async function POST(req: Request) {
  const ip = clientIpFrom(req);

  const limit = rateLimit(`signup:${ip ?? "unknown"}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const result = await signup(
      {
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        displayname: String(body.displayname ?? ""),
        plan: body.plan as "individual" | "corporate",
        orgname: body.orgname ? String(body.orgname) : undefined,
      },
      { ip },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return authErrorResponse(err);
  }
}
