import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/auth/audit";
import { authErrorResponse } from "@/lib/auth/http";
import { refresh } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

/** POST /api/auth/refresh — rotate tokens with reuse detection (FR-005). */
export async function POST(req: Request) {
  try {
    await refresh({ ip: clientIpFrom(req) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err);
  }
}
