import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import {
  deleteAgentTemplate,
  getAgentSkills,
  getAgentTemplate,
  updateAgentTemplate,
} from "@/lib/studio/agents";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    const agent = await getAgentTemplate(ctx.org.id, id);
    const skills = await getAgentSkills(ctx.org.id, id);
    return NextResponse.json({ agent, skills });
  } catch (err) {
    return studioError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson(req);
  try {
    return NextResponse.json({ agent: await updateAgentTemplate(ctx.org.id, id, body) });
  } catch (err) {
    return studioError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    await deleteAgentTemplate(ctx.org.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return studioError(err);
  }
}
