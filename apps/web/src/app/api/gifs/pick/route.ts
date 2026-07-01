import { NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { engineContext, readJson } from "@/lib/engine/http";
import { putObject, storageConfigured } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
// SSRF guard: only re-host from Giphy's own hosts (the URL comes from the client).
const GIPHY_HOST = /^https:\/\/([a-z0-9-]+\.)?giphy\.com\//i;

/**
 * POST /api/gifs/pick { url } — re-host a chosen Giphy GIF into our S3 and return
 * its key (spec 018 FR-009), so GIFs ride the same media path as image uploads.
 */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  if (!storageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });

  const body = await readJson<{ url?: string }>(req);
  const src = body?.url?.trim();
  if (!src || !GIPHY_HOST.test(src)) return NextResponse.json({ error: "invalid_url" }, { status: 400 });

  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
    const type = r.headers.get("content-type") || "image/gif";
    if (!type.startsWith("image/")) return NextResponse.json({ error: "not_an_image" }, { status: 400 });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "bad_size" }, { status: 400 });
    const key = `chat/${ctx.user.id}/${uuidv7()}/giphy.gif`;
    await putObject(key, buf, type, `inline; filename="giphy.gif"`);
    return NextResponse.json({ key }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "pick_failed" }, { status: 502 });
  }
}
