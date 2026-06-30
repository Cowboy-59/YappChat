import { NextResponse } from "next/server";
import { paContext, paError, readJson } from "@/lib/pa/http";
import { deleteProvider, updateProvider } from "@/lib/pa/providers";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = await readJson(req);
  try {
    return NextResponse.json({ provider: await updateProvider(ctx.user.id, id, body) });
  } catch (err) {
    return paError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    await deleteProvider(ctx.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return paError(err);
  }
}
