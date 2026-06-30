import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { readJson } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/ratelimit";
import { requestMagicLink } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/login/magic/request — always 202 (no enumeration) (FR-003). */
export async function POST(req: Request) {
  const ip = clientIpFrom(req);
  const body = await readJson<{ email?: string }>(req);

  const limit = rateLimit(`magic:${ip ?? "unknown"}`, 5, 15 * 60 * 1000);
  if (body?.email && limit.allowed) {
    try {
      await requestMagicLink(body.email);
    } catch (err) {
      console.error("[auth] magic-link request failed:", err);
    }
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
