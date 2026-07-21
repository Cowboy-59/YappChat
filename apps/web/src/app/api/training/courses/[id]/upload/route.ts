import { NextResponse } from "next/server";
import { engineContext, engineError, readJson } from "@/lib/engine/http";
import { createTrainingUploadUrl } from "@/lib/training/service";

export const dynamic = "force-dynamic";

const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/**
 * POST /api/training/courses/:id/upload (JSON: { kind, filename, contentType }) —
 * mint a presigned PUT URL so the client uploads the file DIRECTLY to S3 (bytes
 * never transit the app server). The client then adds an item referencing the
 * returned `key` (mediakey for video, documentkey for document). Author-gated.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await engineContext();
  if (!ctx.ok) return ctx.response;

  const body = await readJson<{ kind?: string; filename?: string; contentType?: string }>(req);
  const kind = body?.kind;
  const filename = body?.filename?.trim();
  const contentType = body?.contentType?.trim();
  if ((kind !== "video" && kind !== "document") || !filename || !contentType) {
    return NextResponse.json({ error: "kind_filename_contenttype_required" }, { status: 400 });
  }
  if (kind === "video" && !contentType.startsWith("video/")) {
    return NextResponse.json({ error: "unsupported_type", allowed: ["video/*"] }, { status: 415 });
  }
  if (kind === "document" && !DOC_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "unsupported_type", allowed: DOC_TYPES }, { status: 415 });
  }

  try {
    const out = await createTrainingUploadUrl(id, ctx.user.id, { filename, contentType }, kind);
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
