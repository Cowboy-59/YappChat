import { NextResponse } from "next/server";
import { paContext, paError, readJson } from "@/lib/pa/http";
import { createProvider, listProviders } from "@/lib/pa/providers";

export const dynamic = "force-dynamic";

/** GET /api/pa/providers — caller's providers with connectivity status. */
export async function GET() {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  return NextResponse.json({ providers: await listProviders(ctx.user.id) });
}

/** POST /api/pa/providers — register a provider (pings on creation). */
export async function POST(req: Request) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const body = await readJson(req);
  try {
    const result = await createProvider(ctx.user.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return paError(err);
  }
}
