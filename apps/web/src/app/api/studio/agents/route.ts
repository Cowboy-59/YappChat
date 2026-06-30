import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import { createAgentTemplate, listAgentTemplates } from "@/lib/studio/agents";

export const dynamic = "force-dynamic";

/** GET /api/studio/agents — list templates with skill counts. */
export async function GET() {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ agents: await listAgentTemplates(ctx.org.id) });
}

/** POST /api/studio/agents — create a template (enabled:false). */
export async function POST(req: Request) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson(req);
  try {
    return NextResponse.json({ agent: await createAgentTemplate(ctx.org.id, body) }, { status: 201 });
  } catch (err) {
    return studioError(err);
  }
}
