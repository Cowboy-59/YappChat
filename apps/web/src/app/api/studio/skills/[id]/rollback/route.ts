import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import { rollbackSkill } from "@/lib/studio/skills";

export const dynamic = "force-dynamic";

/** POST /api/studio/skills/:id/rollback { version } — restore as a NEW version. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ version?: string }>(req);
  if (!body?.version) return NextResponse.json({ error: "version_required" }, { status: 400 });
  try {
    return NextResponse.json({ skill: await rollbackSkill(ctx.org.id, ctx.user.id, id, body.version) });
  } catch (err) {
    return studioError(err);
  }
}
