import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { engineError } from "@/lib/engine/http";
import { updateProfile } from "@/lib/account/service";
import { LANGUAGE_CODES } from "@/lib/account/languages";
import { isPresetPath } from "@/lib/account/avatars";

export const dynamic = "force-dynamic";

const ProfileSchema = z
  .object({
    displayname: z.string().trim().min(1).max(80).optional(),
    bio: z.string().max(2000).nullable().optional(),
    // Either clear the avatar (null) or pick a preset path. Uploaded images are
    // set via POST /api/account/avatar, never through this endpoint.
    avatarurl: z
      .string()
      .nullable()
      .optional()
      .refine((v) => v == null || isPresetPath(v), { message: "avatar must be null or a preset path" }),
    preferredlanguage: z.enum(LANGUAGE_CODES).nullable().optional(),
  })
  .strict();

/** PATCH /api/account/profile — edit the session user's account profile. */
export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", detail: parsed.error.flatten() }, { status: 422 });
  }
  try {
    await updateProfile(auth.user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return engineError(err);
  }
}
