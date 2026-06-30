import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { createCommunity, listMyCommunities } from "@/lib/communities/service";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  avatarurl: z.string().url().optional(),
  slug: z.string().trim().max(48).optional(),
  discoverability: z.enum(["public", "unlisted"]).optional(),
  joinpolicy: z.enum(["open", "approval", "invite"]).optional(),
});

/** GET /api/communities — communities the caller belongs to (home list). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ communities: await listMyCommunities(auth.user.id) });
}

/** POST /api/communities — create a community (caller becomes owner). */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    const community = await createCommunity(parsed.data, auth.user.id);
    return NextResponse.json({ community }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
