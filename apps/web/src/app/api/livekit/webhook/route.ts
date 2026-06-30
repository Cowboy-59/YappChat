import { NextResponse } from "next/server";
import { roomNameToPresentationId, verifyWebhook } from "@/lib/presentations/livekit";
import { registerRecording } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/livekit/webhook — LiveKit egress webhook. On `egress_ended` we record
 * the produced S3 file against its presentation. The request is verified against
 * the LiveKit API secret (see verifyWebhook).
 */
export async function POST(req: Request) {
  const bodyText = await req.text();
  if (!verifyWebhook(req.headers.get("authorization"), bodyText)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (event.event === "egress_ended") {
    const info = (event.egressInfo ?? event.egress_info) as
      | { roomName?: string; room_name?: string; duration?: string | number; fileResults?: unknown[]; file_results?: unknown[]; file?: unknown }
      | undefined;
    const room = info?.roomName ?? info?.room_name;
    const pid = room ? roomNameToPresentationId(room) : null;
    const file = (info?.fileResults?.[0] ?? info?.file_results?.[0] ?? info?.file) as
      | { filename?: string; location?: string }
      | undefined;
    const mediaurl = file?.filename ?? file?.location ?? null;
    // LiveKit reports duration in nanoseconds.
    const durationms = info?.duration ? Math.round(Number(info.duration) / 1e6) : null;
    if (pid && mediaurl) {
      try {
        await registerRecording(pid, { mediaurl, durationms });
      } catch (err) {
        console.error("[livekit-webhook] registerRecording failed:", (err as Error).message);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
