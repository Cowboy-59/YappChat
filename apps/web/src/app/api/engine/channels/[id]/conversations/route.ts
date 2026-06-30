import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { createConversation, listConversations } from "@/lib/engine/service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  return NextResponse.json({ conversations: await listConversations(id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  const body = (await readJson<{ title?: string; kind?: "channel" | "group" | "person" | "agent" }>(req)) ?? {};
  try {
    const conversation = await createConversation(id, { title: body.title, kind: body.kind });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
