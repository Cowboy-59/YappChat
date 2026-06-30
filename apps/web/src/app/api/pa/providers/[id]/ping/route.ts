import { NextResponse } from "next/server";
import { paContext, paError } from "@/lib/pa/http";
import { pingProvider } from "@/lib/pa/providers";

export const dynamic = "force-dynamic";

/** POST /api/pa/providers/:id/ping — test connectivity. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await paContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;
  try {
    return NextResponse.json(await pingProvider(ctx.user.id, id));
  } catch (err) {
    return paError(err);
  }
}
