import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { createGrouping, listGroupings } from "@/lib/groupings/service";

export const dynamic = "force-dynamic";

/** GET /api/chat-groupings — the caller's own groupings (id, name, type, position). */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const groupings = await listGroupings(ctx.user.id);
  return NextResponse.json({ groupings });
}

/** POST /api/chat-groupings { name, type? } — create a grouping owned by the caller. */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ name?: unknown; type?: unknown; position?: unknown }>(req);
  try {
    const grouping = await createGrouping(ctx.user.id, body ?? {});
    return NextResponse.json({ ok: true, grouping }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
