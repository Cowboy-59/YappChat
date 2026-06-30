import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import { runSkillTest } from "@/lib/studio/test-console";

export const dynamic = "force-dynamic";

/** POST /api/studio/skills/:id/test { input } — call the handler, record the exchange. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = (await readJson<{ input?: unknown }>(req)) ?? {};
  try {
    const result = await runSkillTest(ctx.org.id, ctx.user.id, id, body.input ?? {});
    return NextResponse.json(result);
  } catch (err) {
    return studioError(err);
  }
}
