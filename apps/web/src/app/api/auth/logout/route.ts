import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { authErrorResponse } from "@/lib/auth/http";
import { logout } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — revoke session + refresh family, clear cookies (FR-007). */
export async function POST(req: Request) {
  try {
    await logout({ ip: clientIpFrom(req) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
