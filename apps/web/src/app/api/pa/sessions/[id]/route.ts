import { NextResponse } from "next/server";
import { paContext, paError, readJson } from "@/lib/pa/http";
import { getSessionDetail, renameSession, softDeleteSession } from "@/lib/pa/sessions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json({ session: await getSessionDetail(ctx.user.id, id) });
  } catch (err) {
    return paError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson<{ name?: string }>(req);
  if (!body?.name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  try {
    await renameSession(ctx.user.id, id, body.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return paError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    await softDeleteSession(ctx.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return paError(err);
  }
}
