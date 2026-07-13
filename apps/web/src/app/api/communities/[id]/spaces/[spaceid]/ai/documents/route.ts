import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/lib/db/client";
import { spaces } from "@/lib/db/communities-schema";
import { engineError } from "@/lib/engine/http";
import { requireMembership } from "@/lib/communities/policy";
import { putObject, storageConfigured } from "@/lib/storage/s3";
import { addDocumentSource } from "@/lib/communities/spaceai";
import { indexSpaceAi } from "@/lib/communities/spaceai-index";

export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — help docs / manuals

// FR-019 knowledge-source document types (parsed by spaceai-index parseDocument).
// Validated by extension (reliable across browsers) with a MIME allow-list too.
const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  txt: "text/plain",
  html: "text/html",
};

type Params = { params: Promise<{ id: string; spaceid: string }> };

async function assertSpaceInCommunity(communityid: string, spaceid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, spaceid), eq(spaces.communityid, communityid)))
    .limit(1);
  return Boolean(row);
}

/**
 * Spec 017 FR-019 — POST /api/communities/:id/spaces/:spaceid/ai/documents.
 *
 * Upload one help/knowledge document (PDF / DOCX / MD / TXT / HTML) as a per-space
 * AI knowledge source. Owner/moderator only (`space:update`). Stores the file to
 * S3, appends a `pending` document source, and kicks off indexing (chunk + embed
 * into pgvector) so the support bot can answer from it. Returns the new source row.
 */
export async function POST(req: Request, { params }: Params) {
  const { id, spaceid } = await params;
  const ctx = await requireMembership(id, { capability: "space:update" });
  if (!ctx.ok) return ctx.response;
  if (!(await assertSpaceInCommunity(id, spaceid))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!storageConfigured()) return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_required" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!EXT_TYPES[ext]) {
    return NextResponse.json({ error: "unsupported_type", allowed: Object.keys(EXT_TYPES) }, { status: 415 });
  }

  try {
    const key = `spaceai/${spaceid}/${uuidv7()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await putObject(key, buf, file.type || EXT_TYPES[ext], `attachment; filename="${file.name.replace(/"/g, "")}"`);

    const source = await addDocumentSource(spaceid, key, file.name);
    // Index in the background (no-op if AI is disabled — the source stays pending
    // until AI is enabled/refreshed). The client polls GET /ai for status.
    void indexSpaceAi(spaceid).catch((err) => console.error("[spaceai] index after upload failed:", err));

    return NextResponse.json({ source }, { status: 201 });
  } catch (err) {
    return engineError(err);
  }
}
