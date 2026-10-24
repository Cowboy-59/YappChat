import { EngineError } from "../engine/errors";

/**
 * SPEC-093 FR-006 — the retired-room rules, in one dependency-free place so the
 * engine (every posting path) and the room list share exactly the same predicate.
 *
 *  - Posting: a conversation with `retiredat` set takes no new message, from anyone
 *    (web session, agent `yca_` token, system/bot messages, inbound ingest).
 *  - Listing: a retired room is hidden from every member except its owner
 *    (conversationmembers.role = 'owner'), who keeps it with its full history.
 */

// [SCOPE 093 / T006] BEGIN — assertConversationOpen
export function assertConversationOpen(conversation: { retiredat?: Date | null }): void {
  if (conversation.retiredat) {
    throw new EngineError("room_retired", 409, "this room has been retired");
  }
}
// [SCOPE 093 / T006] END

// [SCOPE 093 / T006] BEGIN — isRetiredHiddenFor
/** True when a room must be left out of this member's room list. */
export function isRetiredHiddenFor(row: { retiredat?: Date | null; role?: string | null }): boolean {
  return Boolean(row.retiredat) && row.role !== "owner";
}
// [SCOPE 093 / T006] END
