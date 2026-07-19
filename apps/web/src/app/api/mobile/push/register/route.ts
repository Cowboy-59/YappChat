import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { registerPushToken, unregisterPushToken } from "@/lib/push/service";

export const dynamic = "force-dynamic";

/** POST /api/mobile/push/register { token, platform, deviceid? } — register a device push token. */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ token?: string; platform?: string; deviceid?: string }>(req);
  try {
    await registerPushToken(ctx.user.id, { token: body?.token, platform: body?.platform, deviceid: body?.deviceid });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}

/** DELETE /api/mobile/push/register?token=… — unregister a token (logout). */
export async function DELETE(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const token = new URL(req.url).searchParams.get("token") ?? "";
  await unregisterPushToken(ctx.user.id, token);
  return NextResponse.json({ ok: true });
}
