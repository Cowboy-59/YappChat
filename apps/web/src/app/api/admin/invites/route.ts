import { NextResponse } from "next/server";
import { z } from "zod";
import { engineError } from "@/lib/engine/http";
import { getSessionUser } from "@/lib/auth/session";
import { isSystemStaff } from "@/lib/auth/shared";
import { adminCreateInvite, listAllInvites, type AdminInviteType } from "@/lib/admin/invites";

export const dynamic = "force-dynamic";

// FR-021 reusable options are reused here: maxuses (positive cap / null unlimited /
// omitted single-use); ttlHours capped at 90 days.
const linkFields = {
  communityid: z.string().uuid(),
  maxuses: z.number().int().positive().max(100000).nullable().optional(),
  ttlHours: z.number().int().positive().max(2160).optional(),
};
const CreateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("company"), orgid: z.string().uuid(), email: z.string().email(), role: z.enum(["admin", "member"]) }),
  z.object({ type: z.literal("community"), ...linkFields }),
  z.object({ type: z.literal("space"), ...linkFields, spaceid: z.string().uuid() }),
]);

const TYPES: AdminInviteType[] = ["company", "community", "space"];

/** GET /api/admin/invites — aggregated live invites across the deployment. Spec 013
 *  FR-019. System-staff read (support included). `?type=`, `?q=` filters. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !isSystemStaff(user)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const rawType = url.searchParams.get("type");
  const type = TYPES.find((t) => t === rawType);
  const q = url.searchParams.get("q") ?? undefined;
  try {
    return NextResponse.json({ invites: await listAllInvites({ type, q }) });
  } catch (err) {
    return engineError(err);
  }
}

/** POST /api/admin/invites — create an invite into any company / community / space.
 *  Spec 013 FR-019. System-admin only. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !user.issystemadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  try {
    return NextResponse.json({ result: await adminCreateInvite(parsed.data, user.id) }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
