import { NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { engineContext } from "@/lib/engine/http";
import { putObject, storageConfigured } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — covers images, PDFs, office docs
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** Keep a filename safe for an S3 key path while staying human-readable. */
function safeName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return cleaned || "file";
}

/** POST /api/upload (multipart form, field `file`) — store one file, return its key. */
export async function POST(req: Request) {
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;
  if (!storageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });

  const name = safeName(file.name || "file");
  const type = file.type || "application/octet-stream";
  // Filename is the last key segment so it survives into the presigned URL + download.
  const key = `chat/${ctx.user.id}/${uuidv7()}/${name}`;
  // Inline for images (view in tab); attachment for everything else (download named).
  const disposition = `${IMAGE_TYPES.includes(type) ? "inline" : "attachment"}; filename="${name}"`;

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await putObject(key, buf, type, disposition);
    return NextResponse.json({ key }, { status: 201 });
  } catch (err) {
    console.error("[upload] put failed:", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }
}
