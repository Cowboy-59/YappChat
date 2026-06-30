import { NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { requireAuth } from "@/lib/auth/session";
import { putObject, presignGet, storageConfigured } from "@/lib/storage/s3";
import { updateProfile } from "@/lib/account/service";
import { engineError } from "@/lib/engine/http";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — generous for an avatar image
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * POST /api/account/avatar (multipart form, field `file`) — store one image as the
 * session user's avatar and persist its key on users.avatarurl. Returns a presigned
 * preview URL the client can drop straight into <img src>.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!storageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });

  const type = file.type;
  if (!IMAGE_TYPES.includes(type)) {
    return NextResponse.json({ error: "unsupported_type", allowed: IMAGE_TYPES }, { status: 415 });
  }

  // Unguessable per-user key; filename is irrelevant for an avatar, so just use the ext.
  const key = `avatars/${auth.user.id}/${uuidv7()}.${EXT[type]}`;
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await putObject(key, buf, type, `inline; filename="avatar.${EXT[type]}"`);
    await updateProfile(auth.user.id, { avatarurl: key });
    const previewurl = await presignGet(key);
    return NextResponse.json({ avatarurl: key, previewurl }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
