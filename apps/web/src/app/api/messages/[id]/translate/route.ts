import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { messages } from "@/lib/db/engine-schema";
import { users } from "@/lib/db/auth-schema";
import { isConversationMember } from "@/lib/engine/service";
import { resolveMessageTranslation } from "@/lib/chat/translation";
import { isLanguageCode } from "@/lib/account/languages";
import { engineError } from "@/lib/engine/http";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Spec 017 FR-012 — POST /api/messages/:id/translate.
 *
 * Resolve one message into the viewer's preferred language: cache-or-translate,
 * gated on conversation membership. Source language defaults to the author's
 * account preferredlanguage (FR-010). Same-language (or no target set) returns
 * the original with `translated:false` and performs no model call. Deleted or
 * null-content (e2e/escrow) messages are not translatable in this slice — DM
 * escrow translation lands with spec 018 §7.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

    const [msg] = await db
      .select({
        content: messages.content,
        authorid: messages.authorid,
        conversationid: messages.conversationid,
        deletedat: messages.deletedat,
      })
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);

    if (!msg) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // You may only translate a message in a conversation you belong to.
    if (!msg.conversationid || !(await isConversationMember(msg.conversationid, user.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Deleted, or no plaintext to translate (e2e/escrow) — escrow-DM translation
    // is deferred to spec 018 §7 (server-side decrypt → translate → encrypt cache).
    if (msg.deletedat || msg.content == null) {
      return NextResponse.json({ error: "not_translatable" }, { status: 409 });
    }

    // Target = the viewer's language. Not set → nothing to do (return original).
    const target = user.preferredlanguage;
    if (!target || !isLanguageCode(target)) {
      return NextResponse.json({ content: msg.content, langcode: null, sourcelang: null, translated: false });
    }

    // Source = the author's account language (FR-010 default). authorid is a text
    // column; only look it up when it is a real user uuid.
    let sourcelang = "en";
    if (UUID_RE.test(msg.authorid)) {
      const [author] = await db
        .select({ pl: users.preferredlanguage })
        .from(users)
        .where(eq(users.id, msg.authorid))
        .limit(1);
      if (author?.pl && isLanguageCode(author.pl)) sourcelang = author.pl;
    }

    const result = await resolveMessageTranslation({
      messageid: id,
      text: msg.content,
      sourcelang,
      targetlang: target,
    });

    return NextResponse.json({
      content: result.content,
      langcode: result.langcode,
      sourcelang: result.sourcelang,
      translated: !result.sameLanguage,
    });
  } catch (err) {
    return engineError(err);
  }
}
