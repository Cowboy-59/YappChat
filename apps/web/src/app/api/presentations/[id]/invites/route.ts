import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { createInvite, listInvites } from "@/lib/presentations/service";

export const dynamic = "force-dynamic";

const CreateInviteSchema = z.object({
  kind: z.enum(["public", "private"]),
  inviteduserid: z.string().uuid().nullable().optional(),
  invitedemail: z.string().email().max(320).nullable().optional(),
  expiresat: z.coerce.date().nullable().optional(),
});

/** GET /api/presentations/:id/invites — list invites (host only). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ invites: await listInvites(id, auth.user.id) });
  } catch (err) {
    return engineError(err);
  }
}

/** POST /api/presentations/:id/invites — mint an invite link (host only). Token shown once. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = CreateInviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { invite, token } = await createInvite(id, parsed.data, auth.user.id);
    // Return the plaintext token ONCE; never expose the stored tokenhash.
    return NextResponse.json(
      {
        token,
        invite: {
          id: invite.id,
          kind: invite.kind,
          inviteduserid: invite.inviteduserid,
          invitedemail: invite.invitedemail,
          expiresat: invite.expiresat,
          createdat: invite.createdat,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return engineError(err);
  }
}
