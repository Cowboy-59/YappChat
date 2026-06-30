import { NextResponse } from "next/server";
import { engineContext } from "@/lib/engine/http";
import { searchUsers } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** GET /api/contacts/search?q= — find users to connect with (by name/email). */
export async function GET(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await searchUsers(q, ctx.user.id) });
}
