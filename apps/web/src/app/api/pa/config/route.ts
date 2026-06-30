import { NextResponse } from "next/server";
import { paContext, paError, readJson } from "@/lib/pa/http";
import { getActiveProviderId, setActiveProvider } from "@/lib/pa/providers";

export const dynamic = "force-dynamic";

/** GET /api/pa/config — minimal PA config (active provider) for this slice. */
export async function GET() {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ activeproviderid: await getActiveProviderId(ctx.user.id) });
}

/** PATCH /api/pa/config { providerid } — switch the active provider (no restart). */
export async function PATCH(req: Request) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson<{ providerid?: string }>(req);
  if (!body?.providerid) return NextResponse.json({ error: "providerid_required" }, { status: 400 });
  try {
    await setActiveProvider(ctx.user.id, body.providerid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return paError(err);
  }
}
