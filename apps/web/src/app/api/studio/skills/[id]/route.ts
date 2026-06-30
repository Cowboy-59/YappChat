import { NextResponse } from "next/server";
import { studioContext, studioError, readJson } from "@/lib/studio/http";
import { deleteSkill, getSkill, updateSkill } from "@/lib/studio/skills";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json({ skill: await getSkill(ctx.org.id, id) });
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
    return NextResponse.json({ skill: await updateSkill(ctx.org.id, ctx.user.id, id, body) });
  } catch (err) {
    return studioError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await studioContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = (await readJson<{ override?: boolean }>(req)) ?? {};
  try {
    await deleteSkill(ctx.org.id, id, body.override === true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return studioError(err);
  }
}
