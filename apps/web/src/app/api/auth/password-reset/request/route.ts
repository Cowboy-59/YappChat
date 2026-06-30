import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { readJson } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/ratelimit";
import { requestPasswordReset } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/password-reset/request — always 202 (no enumeration) (FR-006). */
export async function POST(req: Request) {
  const ip = clientIpFrom(req);
  const body = await readJson<{ email?: string }>(req);

  // Soft limit; still respond 202 regardless to avoid revealing state.
  const limit = rateLimit(`pwreset:${ip ?? "unknown"}`, 5, 15 * 60 * 1000);
  if (body?.email && limit.allowed) {
    try {
      await requestPasswordReset(body.email);
    } catch (err) {
      console.error("[auth] password-reset request failed:", err);
    }
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
