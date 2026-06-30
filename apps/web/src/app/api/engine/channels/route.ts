import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { listChannels, registerChannel } from "@/lib/engine/service";
import { INTERNAL_PLATFORM_ID } from "@/lib/engine/plugins/internal";

export const dynamic = "force-dynamic";

/** GET /api/engine/channels — registered channels with health status. */
export async function GET() {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ channels: await listChannels() });
}

/** POST /api/engine/channels — register a channel (defaults to the internal platform). */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = (await readJson<{ platformid?: string; name?: string; config?: unknown }>(req)) ?? {};
  if (!body.name?.trim()) return NextResponse.json({ error: "name_required" }, { status: 400 });
  try {
    const channel = await registerChannel({
      platformid: body.platformid || INTERNAL_PLATFORM_ID,
      name: body.name.trim(),
      config: body.config,
    });
    return NextResponse.json({ channel }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
