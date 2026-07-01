import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { searchUsers } from "@/lib/contacts/service";
import { rateLimit } from "@/lib/auth/ratelimit";

export const dynamic = "force-dynamic";

// Per-user throttle on directory enumeration (delta §10). Tunable; defaults sized
// for normal (debounced) type-ahead while blocking bulk scraping.
const SEARCH_LIMIT = Number(process.env.CONTACT_SEARCH_LIMIT ?? 30);
const SEARCH_WINDOW_MS = Number(process.env.CONTACT_SEARCH_WINDOW_MS ?? 60_000);

/** GET /api/contacts/search?q= — find users to connect with (by name/email). */
export async function GET(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const rl = rateLimit(`contacts:search:${ctx.user.id}`, SEARCH_LIMIT, SEARCH_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchUsers(q, ctx.user.id) });
}
