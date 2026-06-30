import { NextResponse } from "next/server";
import { paContext, paError, readJson } from "@/lib/pa/http";
import { createSession, listSessions } from "@/lib/pa/sessions";

export const dynamic = "force-dynamic";

/** GET /api/pa/sessions — caller's sessions, newest activity first. */
export async function GET() {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ sessions: await listSessions(ctx.user.id) });
}

/** POST /api/pa/sessions { name?, providerid? } — create a session. */
export async function POST(req: Request) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const body = (await readJson<{ name?: string; providerid?: string }>(req)) ?? {};
  try {
    const session = await createSession(ctx.user.id, body);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return paError(err);
  }
}
