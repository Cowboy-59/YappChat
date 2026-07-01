import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the ALB/ECS health check (mirrors the WS engine's GET /health).
 * Deliberately dependency-free — returns 200 as long as the Node server is up, so a
 * transient DB blip doesn't cycle otherwise-healthy tasks.
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "yappchat-web", ts: Date.now() });
}
