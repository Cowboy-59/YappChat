import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";

export const dynamic = "force-dynamic";

const GIPHY = "https://api.giphy.com/v1/gifs";

type GiphyRendition = { url?: string };
type GiphyGif = { id: string; title?: string; images: Record<string, GiphyRendition> };

/**
 * GET /api/gifs/search?q= — Giphy search proxy (spec 018 FR-009). The API key
 * stays server-side; the browser never sees it. Empty q → trending.
 */
export async function GET(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ error: "gif_unconfigured" }, { status: 503 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const base = q
    ? `${GIPHY}/search?q=${encodeURIComponent(q)}&`
    : `${GIPHY}/trending?`;
  const url = `${base}api_key=${key}&limit=24&rating=pg-13`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return NextResponse.json({ error: "giphy_error" }, { status: 502 });
    const data = (await r.json()) as { data?: GiphyGif[] };
    const results = (data.data ?? [])
      .map((g) => ({
        id: g.id,
        title: g.title || "GIF",
        preview: g.images.fixed_height_small?.url || g.images.fixed_height?.url || "",
        url: g.images.fixed_height?.url || g.images.downsized?.url || g.images.original?.url || "",
      }))
      .filter((g) => g.preview && g.url);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "giphy_unreachable" }, { status: 502 });
  }
}
