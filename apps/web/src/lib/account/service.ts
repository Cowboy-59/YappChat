import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/auth-schema";
import { EngineError } from "../engine/errors";

/**
 * Spec 068 — account profile service. Updates the spec 011 `users` row with the
 * caller's editable profile fields (display name + bio/avatar/preferred language).
 * Identity is account-level and carried into every surface.
 */
export async function updateProfile(
  userid: string,
  patch: {
    displayname?: string;
    bio?: string | null;
    avatarurl?: string | null;
    preferredlanguage?: string | null;
  },
): Promise<void> {
  const db = getDb();
  if (!db) throw new EngineError("db_unavailable", 503);
  // Only touch the keys actually provided.
  if (Object.keys(patch).length === 0) return;
  await db
    .update(users)
    .set({ ...patch, updatedat: new Date() })
    .where(eq(users.id, userid));
}
